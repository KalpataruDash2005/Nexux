package com.careeros.rag.config;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.model.ollama.OllamaStreamingChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class LlmConfig {

    private static final Logger log = LoggerFactory.getLogger(LlmConfig.class);

    @Configuration
    @ConditionalOnProperty(name = "llm.provider", havingValue = "ollama", matchIfMissing = true)
    public static class OllamaConfig {

        @Value("${app.ollama.base-url:http://127.0.0.1:11434}")
        private String ollamaBaseUrl;

        @Value("${app.ollama.model:phi3:mini}")
        private String ollamaModelName;

        @Bean
        public ChatLanguageModel chatLanguageModel() {
            log.info("Initializing Ollama ChatLanguageModel (URL: {}, Model: {})", ollamaBaseUrl, ollamaModelName);
            return OllamaChatModel.builder()
                    .baseUrl(ollamaBaseUrl)
                    .modelName(ollamaModelName)
                    .temperature(0.0)
                    .numCtx(8192)
                    .timeout(Duration.ofMinutes(10))
                    .build();
        }

        @Bean
        public StreamingChatLanguageModel streamingChatLanguageModel() {
            log.info("Initializing Ollama StreamingChatLanguageModel (URL: {}, Model: {})", ollamaBaseUrl, ollamaModelName);
            return OllamaStreamingChatModel.builder()
                    .baseUrl(ollamaBaseUrl)
                    .modelName(ollamaModelName)
                    .temperature(0.0)
                    .numCtx(8192)
                    .timeout(Duration.ofMinutes(10))
                    .build();
        }
    }

    @Configuration
    @ConditionalOnProperty(name = "llm.provider", havingValue = "groq")
    public static class GroqConfig {

        @Value("${llm.groq.api-key}")
        private String groqApiKey;

        @Value("${llm.groq.model:llama3-8b-8192}")
        private String groqModelName;

        @Bean
        public ChatLanguageModel chatLanguageModel() {
            log.info("Initializing Groq ChatLanguageModel (Model: {})", groqModelName);
            if (groqApiKey == null || groqApiKey.trim().isEmpty() || groqApiKey.startsWith("${")) {
                throw new IllegalStateException("Groq API key is missing. Please set GROQ_API_KEY environment variable.");
            }
            return OpenAiChatModel.builder()
                    .baseUrl("https://api.groq.com/openai/v1")
                    .apiKey(groqApiKey)
                    .modelName(groqModelName)
                    .temperature(0.0)
                    .timeout(Duration.ofMinutes(2))
                    .build();
        }

        @Bean
        public StreamingChatLanguageModel streamingChatLanguageModel() {
            log.info("Initializing Groq StreamingChatLanguageModel (Model: {})", groqModelName);
            if (groqApiKey == null || groqApiKey.trim().isEmpty() || groqApiKey.startsWith("${")) {
                throw new IllegalStateException("Groq API key is missing. Please set GROQ_API_KEY environment variable.");
            }
            return OpenAiStreamingChatModel.builder()
                    .baseUrl("https://api.groq.com/openai/v1")
                    .apiKey(groqApiKey)
                    .modelName(groqModelName)
                    .temperature(0.0)
                    .timeout(Duration.ofMinutes(2))
                    .build();
        }
    }
}
