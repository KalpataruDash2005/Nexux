package com.careeros.rag.config;

import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2q.AllMiniLmL6V2QuantizedEmbeddingModel;
import io.qdrant.client.QdrantClient;
import io.qdrant.client.QdrantGrpcClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class QdrantConfig {

    @Value("${app.qdrant.host}")
    private String qdrantHost;

    @Value("${app.qdrant.port:443}")
    private int qdrantPort;

    @Value("${app.qdrant.api-key:}")
    private String qdrantApiKey;

    @Value("${app.qdrant.use-tls:false}")
    private boolean useTls;

    @Bean
    public QdrantClient qdrantClient() {
        QdrantGrpcClient.Builder grpcBuilder = QdrantGrpcClient
                .newBuilder(qdrantHost, qdrantPort, useTls)
                .withTimeout(Duration.ofSeconds(10));
        
        if (qdrantApiKey != null && !qdrantApiKey.trim().isEmpty()) {
            grpcBuilder.withApiKey(qdrantApiKey);
        }
        
        return new QdrantClient(grpcBuilder.build());
    }

    @Bean
    public EmbeddingModel embeddingModel() {
        return new AllMiniLmL6V2QuantizedEmbeddingModel();
    }
}
