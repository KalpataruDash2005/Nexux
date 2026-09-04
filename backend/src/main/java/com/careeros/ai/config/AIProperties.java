package com.careeros.ai.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "ai")
@Getter
@Setter
public class AIProperties {
    private int maxOutputTokens = 1200;
    private int maxConcurrentRequests = 2;
    private int requestTimeoutSeconds = 30;
    private int maxRetries = 2;
    private Retry retry = new Retry();
    
    private ProviderConfig groq = new ProviderConfig();
    private ProviderConfig gemini = new ProviderConfig();
    private ProviderConfig openrouter = new ProviderConfig();

    public AIProperties() {
        groq.setBaseUrl("https://api.groq.com/openai/v1");
        groq.setModel("mixtral-8x7b-32768");
        groq.setTimeoutSeconds(5);
        
        gemini.setModel("gemini-3.6-flash");
        gemini.setTimeoutSeconds(10);
        
        openrouter.setBaseUrl("https://openrouter.ai/api/v1");
        openrouter.setModel("openrouter/free");
        openrouter.setTimeoutSeconds(8);
    }

    @Getter
    @Setter
    public static class Retry {
        private long initialDelayMs = 2000;
        private long maxDelayMs = 10000;
    }

    @Getter
    @Setter
    public static class ProviderConfig {
        private boolean enabled = true;
        private String apiKey;
        private String baseUrl;
        private String model;
        private int timeoutSeconds = 10;
    }
}




