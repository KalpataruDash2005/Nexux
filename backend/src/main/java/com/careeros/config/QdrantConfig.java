package com.careeros.config;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2q.AllMiniLmL6V2QuantizedEmbeddingModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import io.qdrant.client.QdrantClient;
import io.qdrant.client.QdrantGrpcClient;
import io.qdrant.client.grpc.Collections.Distance;
import io.qdrant.client.grpc.Collections.VectorParams;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Configuration
@Slf4j
public class QdrantConfig {

    private static final String COLLECTION_NAME = "careeros_chunks";
    private static final int EMBEDDING_DIMENSION = 384;

    @Value("${app.qdrant.host:127.0.0.1}")
    private String qdrantHost;

    @Value("${app.qdrant.port:6334}")
    private int qdrantPort;

    @Value("${app.pdf-assistant.qdrant-api-key:}")
    private String qdrantApiKey;

    @Value("${app.qdrant.use-tls:false}")
    private boolean useTls;

    @Value("${app.openai.api-key:your_default_key_here}")
    private String groqApiKey;

    @Value("${app.openai.base-url:https://api.groq.com/openai/v1}")
    private String groqBaseUrl;

    @Value("${app.openai.model:openai/gpt-oss-120b}")
    private String groqModel;

    @PostConstruct
    public void ensureCollectionExists() {
        log.info("--- Qdrant Connection Diagnostics ---");
        log.info("QDRANT_HOST: {}", qdrantHost);
        log.info("QDRANT_GRPC_PORT: {}", qdrantPort);
        log.info("QDRANT_TLS_ENABLED: {}", useTls);
        log.info("-------------------------------------");

        try {
            QdrantGrpcClient.Builder grpcBuilder = QdrantGrpcClient
                    .newBuilder(qdrantHost, qdrantPort, useTls)
                    .withTimeout(Duration.ofSeconds(5));
            if (qdrantApiKey != null && !qdrantApiKey.trim().isEmpty()) {
                grpcBuilder.withApiKey(qdrantApiKey);
            }
            QdrantClient client = new QdrantClient(grpcBuilder.build());
            try {
                List<String> collections = client.listCollectionsAsync().get(10, TimeUnit.SECONDS);
                if (collections.contains(COLLECTION_NAME)) {
                    log.info("Qdrant collection '{}' already exists", COLLECTION_NAME);
                } else {
                    VectorParams params = VectorParams.newBuilder()
                            .setSize(EMBEDDING_DIMENSION)
                            .setDistance(Distance.Cosine)
                            .build();
                    client.createCollectionAsync(COLLECTION_NAME, params).get(10, TimeUnit.SECONDS);
                    log.info("Created Qdrant collection '{}' with dimension {}", COLLECTION_NAME, EMBEDDING_DIMENSION);
                }
            } finally {
                client.close();
            }
        } catch (Exception e) {
            log.warn("Could not ensure Qdrant collection '{}' exists (will be retried on next start): {}",
                    COLLECTION_NAME, e.getMessage());
        }
    }

    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        return QdrantEmbeddingStore.builder()
                .host(qdrantHost)
                .port(qdrantPort)
                .useTls(useTls)
                .collectionName(COLLECTION_NAME)
                .build();
    }

    @Bean
    public EmbeddingModel embeddingModel() {
        // Use free local embeddings instead of OpenAI
        return new AllMiniLmL6V2QuantizedEmbeddingModel();
    }

    @Bean
    public ChatLanguageModel chatLanguageModel() {
        // Use Groq's OpenAI compatible API
        return OpenAiChatModel.builder()
                .baseUrl(groqBaseUrl)
                .apiKey(groqApiKey)
                .modelName(groqModel)
                .maxTokens(4096)
                .timeout(java.time.Duration.ofSeconds(120))
                .maxRetries(2)
                .build();
    }
}


