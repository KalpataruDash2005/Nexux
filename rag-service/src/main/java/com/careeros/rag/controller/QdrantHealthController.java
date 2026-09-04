package com.careeros.rag.controller;

import io.qdrant.client.QdrantClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class QdrantHealthController {

    private final QdrantClient qdrantClient;

    @Value("${app.qdrant.host}")
    private String qdrantHost;

    @Value("${app.qdrant.port}")
    private int qdrantPort;

    public QdrantHealthController(QdrantClient qdrantClient) {
        this.qdrantClient = qdrantClient;
    }

    @GetMapping("/health/qdrant")
    public Map<String, Object> qdrantHealth() {
        Map<String, Object> response = new HashMap<>();
        response.put("configured_host", qdrantHost);
        response.put("configured_port", qdrantPort);
        
        try {
            List<String> collections = qdrantClient.listCollectionsAsync().get(5, TimeUnit.SECONDS);
            response.put("status", "UP");
            response.put("qdrant", "CONNECTED");
            response.put("collection_count", collections.size());
            response.put("collections", collections);
        } catch (Exception e) {
            response.put("status", "DOWN");
            response.put("qdrant", "DISCONNECTED");
            response.put("error", e.getMessage());
        }
        return response;
    }
}
