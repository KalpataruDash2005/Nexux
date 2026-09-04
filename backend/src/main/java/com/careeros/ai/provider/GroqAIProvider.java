package com.careeros.ai.provider;


import com.careeros.ai.config.AIProperties;
import com.careeros.ai.exception.AIException;
import com.careeros.ai.exception.AIProviderException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
public class GroqAIProvider implements AIProvider {

    private final AIProperties aiProperties;
    private final RestClient restClient;

    public GroqAIProvider(
            AIProperties aiProperties,
            RestClient.Builder restClientBuilder
    ) {
        this.aiProperties = aiProperties;
        org.springframework.http.client.JdkClientHttpRequestFactory factory = new org.springframework.http.client.JdkClientHttpRequestFactory();
        factory.setReadTimeout(java.time.Duration.ofSeconds(aiProperties.getGroq().getTimeoutSeconds()));
        this.restClient = restClientBuilder.clone().requestFactory(factory).build();
    }

    @Override
    public String getName() {
        return "GROQ";
    }

    @Override
    public boolean isAvailable() {
        return aiProperties.getGroq() != null 
                && aiProperties.getGroq().isEnabled() 
                && aiProperties.getGroq().getApiKey() != null 
                && !aiProperties.getGroq().getApiKey().isBlank();
    }

    @Override
    public String generate(
            String model,
            String systemPrompt,
            String userPrompt,
            double temperature,
            int maxTokens,
            boolean jsonMode
    ) {

        AIProperties.ProviderConfig config = aiProperties.getGroq();

        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            throw new AIException("API key not configured");
        }

        Map<String, Object> body = buildBody(
                model,
                systemPrompt,
                userPrompt,
                temperature,
                maxTokens,
                jsonMode
        );

        Exception lastError = null;
        int maxRetries = aiProperties.getMaxRetries();

        for (int attempt = 1; attempt <= maxRetries + 1; attempt++) {

            try {
                log.info("Calling Groq | model={} | jsonMode={}", model, jsonMode);

                Map<?, ?> json = restClient.post()
                        .uri(config.getBaseUrl() + "/chat/completions")
                        .header("Authorization", "Bearer " + config.getApiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(Map.class);

                if (json == null) {
                    throw new IllegalStateException("Empty response from Groq");
                }

                List<?> choices = (List<?>) json.get("choices");

                if (choices == null || choices.isEmpty()) {
                    log.error("Groq COMPLETE response: {}", json);
                    throw new IllegalStateException("No choices in Groq response");
                }

                Object firstChoice = choices.get(0);

                if (!(firstChoice instanceof Map<?, ?> firstChoiceMap)) {
                    log.error("Groq COMPLETE response: {}", json);
                    throw new IllegalStateException("Unexpected choice response shape");
                }

                Object messageObject = firstChoiceMap.get("message");

                if (!(messageObject instanceof Map<?, ?> message)) {
                    log.error("Groq COMPLETE response: {}", json);
                    throw new IllegalStateException("Unexpected message response shape");
                }

                String content = extractString(message.get("content"));
                if (content != null && !content.isBlank()) {
                    return content.trim();
                }

                String finishReason = extractString(firstChoiceMap.get("finish_reason"));
                boolean hasReasoning = message.get("reasoning_content") != null || message.get("reasoning") != null;

                if ("length".equalsIgnoreCase(finishReason)) {
                    log.error("Groq model ran out of tokens (finish_reason: length). Model: {}, Has Reasoning: {}, COMPLETE response: {}", 
                              model, hasReasoning, json);
                    throw new AIProviderException(getName(), "Model ran out of tokens during reasoning (finish_reason: length)");
                }

                log.error("Groq returned empty final content. Model: {}, Finish Reason: {}, Has Reasoning: {}, COMPLETE response: {}", 
                          model, finishReason, hasReasoning, json);

                throw new IllegalStateException("Groq returned empty final content");

            } catch (Exception e) {
                lastError = e;
                String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();

                if (e instanceof AIProviderException) {
                    throw (AIProviderException) e;
                }

                if (e instanceof IllegalStateException && msg.contains("empty final content")) {
                    log.error("Groq request failed after attempt {}: {}", attempt, e.getMessage());
                    throw new AIProviderException(getName(), "Provider call failed: " + e.getMessage(), e);
                }

                boolean isRateLimit = msg.contains("429") || msg.contains("rate_limit_exceeded");
                boolean isTransient = msg.contains("500") || msg.contains("502") || msg.contains("503") || msg.contains("504") || msg.contains("timeout") || msg.contains("connection reset");
                boolean isFatal = isRateLimit || msg.contains("400") || msg.contains("401") || msg.contains("403") || msg.contains("json_validate_failed") || msg.contains("invalid_request");

                if (e instanceof RestClientResponseException rce) {
                    String errorBody = rce.getResponseBodyAsString();
                    int status = rce.getStatusCode().value();
                    log.error("Groq API error response (HTTP {}): {}", status, errorBody);
                    
                    isRateLimit = status == 429;
                    isTransient = status == 500 || status == 502 || status == 503 || status == 504;
                    isFatal = status == 400 || status == 401 || status == 403 || status == 429;
                    
                    // For retry logic delay calculation
                    msg = errorBody.toLowerCase(); 
                }

if (isFatal || !isTransient || attempt > maxRetries) {
                    log.error("Groq request failed after attempt {}: {}", attempt, e.getMessage());
                    throw new AIProviderException(getName(), "Provider call failed: " + e.getMessage(), e);
                }

                long waitMs = retryDelayMs(msg, attempt);
                log.warn("Transient Groq error. Retrying {}/{} after {}ms", attempt, maxRetries, waitMs);
                // Retry immediately without sleeping to avoid holding semaphore permit during wait.
                // The loop will iterate to the next attempt; after maxRetries+1 attempts the provider
                // will throw AIProviderException, allowing AIService to fallback.
            }
        }

        throw new AIException("Provider call failed after retries", lastError);
    }

    private String extractString(Object value) {
        if (value == null) return null;
        if (value instanceof String stringValue) return stringValue;
        return String.valueOf(value);
    }

    private Map<String, Object> buildBody(
            String model,
            String system,
            String user,
            double temperature,
            int maxTokens,
            boolean jsonMode
    ) {
        List<Map<String, Object>> messages = new ArrayList<>();

        Map<String, Object> systemMessage = new LinkedHashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", system);
        messages.add(systemMessage);

        Map<String, Object> userMessage = new LinkedHashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", user);
        messages.add(userMessage);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);

        if (jsonMode) {
            // response_format is intentionally omitted.
            // Provider-native JSON mode causes HTTP 400 on this account/configuration.
            // The model is prompted via system instruction to return ONLY valid JSON.
            // Gateway-level validation in AIService.isValidJson() handles JSON parsing.
        }
        
        // Lower reasoning effort for complex structured tasks to save token budget
        if (model != null && model.contains("gpt-oss")) {
            body.put("reasoning_effort", "low");
        }
        
        body.put("messages", messages);

        return body;
    }

    private long retryDelayMs(String message, int attempt) {
        Matcher matcher = Pattern.compile("try again in (\\d+(?:\\.\\d+)?)\\s*s").matcher(message == null ? "" : message);
        if (matcher.find()) {
            long seconds = (long) Math.ceil(Double.parseDouble(matcher.group(1)));
            if (seconds >= 1 && seconds <= 120) {
                return seconds * 1000L;
            }
        }
        long baseDelay = aiProperties.getRetry().getInitialDelayMs();
        long maxDelay = aiProperties.getRetry().getMaxDelayMs();
        long calculated = baseDelay * (long) Math.pow(2, attempt - 1);
        return Math.min(calculated, maxDelay);
    }
}













