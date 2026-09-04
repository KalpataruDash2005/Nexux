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
public class OpenRouterAIProvider implements AIProvider {

    private final AIProperties aiProperties;
    private final RestClient restClient;

    public OpenRouterAIProvider(
            AIProperties aiProperties,
            RestClient.Builder restClientBuilder
    ) {
        this.aiProperties = aiProperties;
        org.springframework.http.client.JdkClientHttpRequestFactory factory = new org.springframework.http.client.JdkClientHttpRequestFactory();
        factory.setReadTimeout(java.time.Duration.ofSeconds(aiProperties.getOpenrouter().getTimeoutSeconds()));
        this.restClient = restClientBuilder.clone().requestFactory(factory).build();
    }

    @Override
    public String getName() {
        return "OPENROUTER";
    }

    @Override
    public boolean isAvailable() {
        return aiProperties.getOpenrouter() != null 
                && aiProperties.getOpenrouter().isEnabled() 
                && aiProperties.getOpenrouter().getApiKey() != null 
                && !aiProperties.getOpenrouter().getApiKey().isBlank();
    }

    @Override
    public String generate(String model, String systemPrompt, String userPrompt, double temperature, int maxTokens, boolean jsonMode) {
        
        AIProperties.ProviderConfig config = aiProperties.getOpenrouter();
        
        Map<String, Object> body = buildBody(model, systemPrompt, userPrompt, temperature, maxTokens, jsonMode);

        try {
            log.debug("Calling OpenRouter | model={} | jsonMode={}", model, jsonMode);

            Map<?, ?> response = restClient.post()
                    .uri(config.getBaseUrl() + "/chat/completions")
                    .header("Authorization", "Bearer " + config.getApiKey())
                    .header("HTTP-Referer", "https://careeros.com") // Recommended by OpenRouter
                    .header("X-Title", "CareerOS") // Recommended by OpenRouter
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) {
                throw new IllegalStateException("Empty response from OpenRouter");
            }

            Object choicesObject = response.get("choices");
            if (!(choicesObject instanceof List<?> choices) || choices.isEmpty()) {
                log.error("No choices returned from OpenRouter. Full response: {}", response);
                throw new IllegalStateException("No choices returned from OpenRouter");
            }

            Object firstChoice = choices.get(0);
            if (!(firstChoice instanceof Map<?, ?> choice)) {
                log.error("Invalid choice format from OpenRouter. Full response: {}", response);
                throw new IllegalStateException("Invalid choice format from OpenRouter");
            }

            Object messageObject = choice.get("message");
            if (!(messageObject instanceof Map<?, ?> message)) {
                log.error("Invalid message format from OpenRouter. Full response: {}", response);
                throw new IllegalStateException("Invalid message format from OpenRouter");
            }

            Object contentObj = message.get("content");
            String result = contentObj != null ? String.valueOf(contentObj).trim() : "";
            
            if (result.isBlank()) {
                log.error("OpenRouter returned empty content. Full response: {}", response);
                throw new IllegalStateException("OpenRouter returned empty content");
            }

            return result;

        } catch (Exception e) {
            String errorMsg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
            if (e instanceof RestClientResponseException rce) {
                log.error("OpenRouter API error (HTTP {}): {}", rce.getStatusCode().value(), rce.getResponseBodyAsString());
                errorMsg = rce.getResponseBodyAsString();
            }
            throw new AIProviderException(getName(), "Provider call failed: " + errorMsg, e);
        }
    }

    private Map<String, Object> buildBody(String model, String system, String user, double temperature, int maxTokens, boolean jsonMode) {
        
        List<Map<String, Object>> messages = new ArrayList<>();

        if (system != null && !system.isBlank()) {
            Map<String, Object> systemMessage = new LinkedHashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", system);
            messages.add(systemMessage);
        }

        Map<String, Object> userMessage = new LinkedHashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", user);
        messages.add(userMessage);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", jsonMode ? Math.min(temperature, 0.3) : temperature);
        body.put("max_tokens", maxTokens);
        body.put("messages", messages);
        
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }

        return body;
    }
}
