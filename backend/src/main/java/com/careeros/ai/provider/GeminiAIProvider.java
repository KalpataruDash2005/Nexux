package com.careeros.ai.provider;

import com.careeros.ai.config.AIProperties;
import com.careeros.ai.exception.AIProviderException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
public class GeminiAIProvider implements AIProvider {

    private final AIProperties aiProperties;
    private final RestClient restClient;
    private final String baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/";

    public GeminiAIProvider(AIProperties aiProperties, RestClient.Builder restClientBuilder) {
        this.aiProperties = aiProperties;
        org.springframework.http.client.JdkClientHttpRequestFactory factory = new org.springframework.http.client.JdkClientHttpRequestFactory();
        factory.setReadTimeout(java.time.Duration.ofSeconds(aiProperties.getGemini().getTimeoutSeconds()));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public String getName() {
        return "GEMINI";
    }

    @Override
    public boolean isAvailable() {
        return aiProperties.getGemini() != null 
                && aiProperties.getGemini().isEnabled() 
                && aiProperties.getGemini().getApiKey() != null 
                && !aiProperties.getGemini().getApiKey().isBlank();
    }

    @Override
    public String generate(String model, String systemPrompt, String userPrompt, double temperature, int maxTokens, boolean jsonMode) {
        
        AIProperties.ProviderConfig config = aiProperties.getGemini();
        if (model == null || model.isBlank()) {
            model = "gemini-3.6-flash";
        }
        
        String url = baseUrl + model + ":generateContent?key=" + config.getApiKey();

        Map<String, Object> body = buildBody(systemPrompt, userPrompt, temperature, maxTokens, jsonMode);

        try {
            log.debug("Calling Gemini | model={} | jsonMode={}", model, jsonMode);

            Map<?, ?> response = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) {
                throw new IllegalStateException("Empty response from Gemini");
            }

            List<?> candidates = (List<?>) response.get("candidates");
            if (candidates == null || candidates.isEmpty()) {
                log.error("Gemini COMPLETE response: {}", response);
                throw new IllegalStateException("No candidates in Gemini response");
            }

            Map<?, ?> firstCandidate = (Map<?, ?>) candidates.get(0);
            Map<?, ?> content = (Map<?, ?>) firstCandidate.get("content");
            if (content == null) {
                log.error("Gemini COMPLETE response: {}", response);
                throw new IllegalStateException("Empty content in Gemini response");
            }

            List<?> parts = (List<?>) content.get("parts");
            if (parts == null || parts.isEmpty()) {
                log.error("Gemini COMPLETE response: {}", response);
                throw new IllegalStateException("No parts in Gemini response");
            }

            Map<?, ?> firstPart = (Map<?, ?>) parts.get(0);
            Object textObj = firstPart.get("text");
            
            if (textObj == null || String.valueOf(textObj).isBlank()) {
                log.error("Gemini COMPLETE response: {}", response);
                throw new IllegalStateException("Gemini returned blank text");
            }

            return String.valueOf(textObj).trim();

        } catch (Exception e) {
            String errorMsg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
            if (e instanceof RestClientResponseException rce) {
                log.error("Gemini API error (HTTP {}): {}", rce.getStatusCode().value(), rce.getResponseBodyAsString());
                errorMsg = rce.getResponseBodyAsString();
            }
            throw new AIProviderException(getName(), "Provider call failed: " + errorMsg, e);
        }
    }

    private Map<String, Object> buildBody(String system, String user, double temperature, int maxTokens, boolean jsonMode) {
        
        Map<String, Object> body = new LinkedHashMap<>();
        
        // System instruction
        if (system != null && !system.isBlank()) {
            Map<String, Object> systemInstruction = new LinkedHashMap<>();
            systemInstruction.put("parts", List.of(Map.of("text", system)));
            body.put("systemInstruction", systemInstruction);
        }
        
        // Contents
        List<Map<String, Object>> contents = new ArrayList<>();
        Map<String, Object> userContent = new LinkedHashMap<>();
        userContent.put("role", "user");
        userContent.put("parts", List.of(Map.of("text", user)));
        contents.add(userContent);
        body.put("contents", contents);

        // Generation config
        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", jsonMode ? Math.min(temperature, 0.3) : temperature);
        generationConfig.put("maxOutputTokens", maxTokens);
        
        if (jsonMode) {
            // Note: responseMimeType is intentionally omitted.
            // The model is prompted via system instruction to return ONLY valid JSON.
            // Gateway-level validation in AIService.parseJsonSafely() handles JSON parsing.
        }
        
        body.put("generationConfig", generationConfig);

        return body;
    }
}

