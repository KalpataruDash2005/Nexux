package com.careeros.ai;

import com.careeros.ai.config.AIProperties;
import com.careeros.ai.exception.AIException;
import com.careeros.ai.exception.AIProviderException;
import com.careeros.ai.provider.AIProvider;
import com.careeros.ai.provider.GeminiAIProvider;
import com.careeros.ai.provider.GroqAIProvider;
import com.careeros.ai.provider.OpenRouterAIProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIService {

    private final AIProperties aiProperties;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;
    private final AITaskRouter taskRouter;

    private final List<AIProvider> availableProviders = new ArrayList<>();
    private Semaphore semaphore;

    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("AI Gateway initialized");

        AIProvider groq = new GroqAIProvider(aiProperties, restClientBuilder);
        AIProvider gemini = new GeminiAIProvider(aiProperties, restClientBuilder);
        AIProvider openRouter = new OpenRouterAIProvider(aiProperties, restClientBuilder);

        if (groq.isAvailable()) availableProviders.add(groq);
        if (gemini.isAvailable()) availableProviders.add(gemini);
        if (openRouter.isAvailable()) availableProviders.add(openRouter);

        log.info("GROQ available: {}", groq.isAvailable());
        log.info("GEMINI available: {}", gemini.isAvailable());
        log.info("OPENROUTER available: {}", openRouter.isAvailable());

        if (availableProviders.isEmpty()) {
            log.warn("No AI Providers are currently available! Please configure API keys.");
        }

        semaphore = new Semaphore(aiProperties.getMaxConcurrentRequests());
    }

    private String hashPrompt(String system, String user, double temperature, int maxTokens, boolean jsonMode) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String combined = system + "|" + user + "|" + temperature + "|" + maxTokens + "|" + jsonMode;
            byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            return UUID.randomUUID().toString();
        }
    }

    private int determineOutputTokens(AITask task, int maxTokens) {
        if (maxTokens > 0) return maxTokens;
        
        switch (task) {
            case GENERAL_CHAT:
                return 400;
            case INTERVIEW_ASSISTANCE:
                return 600;
            case APTITUDE_GENERATION:
                return 800;
            case RESUME_ANALYSIS:
                return 1000;
            case CODING_ASSISTANCE:
                return 1500;
            case PLACEMENT_READINESS:
            case PLACEMENT_ROADMAP:
                return 2500;
            default:
                return aiProperties.getMaxOutputTokens();
        }
    }

    private String extractJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String text = raw.trim();
        
        // Remove markdown fences
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            if (firstNewline != -1) text = text.substring(firstNewline + 1);
            int lastFence = text.lastIndexOf("```");
            if (lastFence != -1) text = text.substring(0, lastFence);
            text = text.trim();
        }

        int firstBrace = text.indexOf('{');
        int firstBracket = text.indexOf('[');
        
        if (firstBrace == -1 && firstBracket == -1) return text;
        
        boolean isObject = (firstBrace != -1 && (firstBracket == -1 || firstBrace < firstBracket));
        int start = isObject ? firstBrace : firstBracket;
        char open = isObject ? '{' : '[';
        char close = isObject ? '}' : ']';
        
        int depth = 0;
        boolean inQuotes = false;
        boolean escape = false;
        
        for (int i = start; i < text.length(); i++) {
            char c = text.charAt(i);
            
            if (escape) {
                escape = false;
                continue;
            }
            if (c == '\\') {
                escape = true;
                continue;
            }
            if (c == '"') {
                inQuotes = !inQuotes;
                continue;
            }
            
            if (!inQuotes) {
                if (c == open) depth++;
                else if (c == close) depth--;
                
                if (depth == 0) {
                    return text.substring(start, i + 1);
                }
            }
        }
        
        return text;
    }

    private boolean isValidJson(String raw) {
        String json = extractJson(raw);
        if (json == null) return false;
        try {
            objectMapper.readTree(json);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String generate(AITask task, String systemPrompt, String userPrompt, double temperature, int maxTokens, boolean jsonMode) {
        int finalTokens = determineOutputTokens(task, maxTokens);
        String fingerprint = task.name() + ":" + hashPrompt(systemPrompt, userPrompt, temperature, finalTokens, jsonMode);
        
        boolean cacheable = task == AITask.RESUME_ANALYSIS || task == AITask.PLACEMENT_READINESS || task == AITask.PLACEMENT_ROADMAP;
        
        if (cacheable) {
            String cachedResponse = cache.get(fingerprint);
            if (cachedResponse != null) {
                log.info("Reusing cached AI response for task: {}", task);
                return cachedResponse;
            }
        }

        String reqId = UUID.randomUUID().toString().substring(0, 8);
        long startMs = System.currentTimeMillis();
        int systemLength = systemPrompt == null ? 0 : systemPrompt.length();
        int userLength = userPrompt == null ? 0 : userPrompt.length();
        int estimatedInputTokens = (systemLength + userLength) / 4;

        log.info("[AI-GATEWAY] AI task started | RequestId={} | Task={}", reqId, task);

        boolean acquired = false;
        try {
            acquired = semaphore.tryAcquire(aiProperties.getRequestTimeoutSeconds(), TimeUnit.SECONDS);
            if (!acquired) {
                throw new AIException("AI request queue overloaded. Timeout waiting for available AI slot.");
            }

            Exception lastException = null;
            String result = null;
            String successfulProvider = null;
            String successfulModel = null;
            int totalAttempts = 0;

            if (availableProviders.isEmpty()) {
                throw new AIProviderException("SYSTEM", "No AI providers configured or enabled");
            }

            List<AITaskRoute> routes = taskRouter.getRoutes(task, availableProviders);

            for (int i = 0; i < routes.size(); i++) {
                totalAttempts++;
                AITaskRoute route = routes.get(i);
                AIProvider provider = route.provider();
                String model = route.model();
                long routeStartMs = System.currentTimeMillis();
                try {
                    log.info("[AI-GATEWAY] RequestId={} | Task={} | Provider={} | Model={} | Attempt={}", reqId, task, provider.getName(), model, i + 1);
                    result = provider.generate(model, systemPrompt, userPrompt, temperature, finalTokens, jsonMode);
                    long routeDuration = System.currentTimeMillis() - routeStartMs;
                    
                    if (result == null || result.isBlank()) {
                        log.warn("[AI-GATEWAY] RequestId={} | Task={} | Attempt={} | Provider={} | Model={} | Status=FAILED | Reason=EMPTY_RESPONSE | Duration={}ms", 
                                 reqId, task, i + 1, provider.getName(), model, routeDuration);
                        taskRouter.recordFailure(task, provider.getName(), model, "EMPTY_RESPONSE");
                        lastException = new AIProviderException(provider.getName(), "Empty response");
                        result = null;
                    } else {
                        boolean requiresJson = jsonMode || (systemPrompt != null && systemPrompt.contains("Return ONLY valid JSON"));
                        if (requiresJson && !isValidJson(result)) {
                            String preview = result.length() > 150 ? result.substring(0, 150).replace('\n', ' ') + "..." : result.replace('\n', ' ');
                            log.warn("[AI-GATEWAY] RequestId={} | Task={} | Attempt={} | Provider={} | Model={} | Status=FAILED | Reason=INVALID_JSON | Duration={}ms | Preview={}", 
                                     reqId, task, i + 1, provider.getName(), model, routeDuration, preview);
                            taskRouter.recordFailure(task, provider.getName(), model, "INVALID_JSON");
                            lastException = new AIProviderException(provider.getName(), "Invalid JSON structure");
                            result = null; // Mark as failed to trigger fallback
                        } else {
                            log.info("[AI-GATEWAY] RequestId={} | Task={} | Provider={} | Model={} | Attempt={} | Duration={}ms | Status=SUCCESS", 
                                     reqId, task, provider.getName(), model, i + 1, routeDuration);
                            taskRouter.recordSuccess(task, provider.getName(), model, routeDuration);
                            successfulProvider = provider.getName();
                            successfulModel = model;
                            break;
                        }
                    }
                } catch (IllegalArgumentException | NullPointerException e) {
                    long routeDuration = System.currentTimeMillis() - routeStartMs;
                    log.error("[AI-GATEWAY] RequestId={} | Task={} | Attempt={} | Provider={} | Model={} | Status=FAILED | Reason=NON_RETRYABLE_ERROR | Duration={}ms", 
                             reqId, task, i + 1, provider.getName(), model, routeDuration, e);
                    throw e;
                } catch (Exception e) {
                    long routeDuration = System.currentTimeMillis() - routeStartMs;
                    lastException = e;
                    String reason = e.getMessage() != null && e.getMessage().contains("length") ? "FINISH_REASON_LENGTH" : e.getMessage();
                    log.warn("[AI-GATEWAY] RequestId={} | Task={} | Attempt={} | Provider={} | Model={} | Status=FAILED | Reason={} | Duration={}ms", 
                             reqId, task, i + 1, provider.getName(), model, reason, routeDuration);
                    taskRouter.recordFailure(task, provider.getName(), model, reason);
                }
                
                if (result == null || result.isBlank()) {
                    if (i + 1 < routes.size()) {
                        AITaskRoute nextRoute = routes.get(i + 1);
                        log.info("[AI-GATEWAY] RequestId={} | Fallback=true | NextProvider={}", reqId, nextRoute.provider().getName());
                    }
                }
            }

            if (result == null || result.isBlank()) {
                throw new AIProviderException("GATEWAY", "All available providers failed to generate content", lastException);
            }

            long totalDuration = System.currentTimeMillis() - startMs;
            log.info("[AI-GATEWAY] RequestId={} | Task={} | TotalAttempts={} | TotalDuration={}ms | FinalProvider={} | FinalModel={} | Status=SUCCESS", 
                     reqId, task, totalAttempts, totalDuration, successfulProvider, successfulModel);

            if (cacheable) {
                cache.put(fingerprint, result);
            }

            return result;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AIException("Interrupted while waiting for AI request slot", e);
        } catch (AIException e) {
            throw e;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startMs;
            log.error("[AI-GATEWAY] RequestId={} | Task={} | TotalDuration={}ms | Status=FAILED | Error={}", reqId, task, duration, e.getMessage());
            throw new AIException("AI request failed", e);
        } finally {
            if (acquired) {
                semaphore.release();
            }
        }
    }

    public <T> T generateJson(AITask task, String systemPrompt, String userPrompt, Class<T> responseType, double temperature, int maxTokens) {
        String robustSystem = systemPrompt + "\n\nReturn ONLY valid JSON. Do not include markdown, explanations, comments, or text outside the JSON object.\n";
        String rawJson = generate(task, robustSystem, userPrompt, temperature, maxTokens, true);
        return parseJsonSafely(rawJson, responseType);
    }

    private <T> T parseJsonSafely(String raw, Class<T> type) {
        if (raw == null || raw.isBlank()) {
            throw new AIException("AI returned empty response");
        }
        String json = extractJson(raw);
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            log.error("Failed to parse AI JSON response: {}", json.length() > 1000 ? json.substring(0, 1000) : json);
            throw new AIException("AI returned invalid JSON format", e);
        }
    }
}




