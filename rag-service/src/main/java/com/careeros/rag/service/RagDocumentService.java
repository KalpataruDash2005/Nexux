package com.careeros.rag.service;

import io.qdrant.client.QdrantClient;
import io.qdrant.client.grpc.Points.Condition;
import io.qdrant.client.grpc.Points.FieldCondition;
import io.qdrant.client.grpc.Points.Filter;
import io.qdrant.client.grpc.Points.Match;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class RagDocumentService {

    private static final Logger log = LoggerFactory.getLogger(RagDocumentService.class);
    private static final String COLLECTION_NAME = "careeros_chunks";
    private final QdrantClient qdrantClient;

    public RagDocumentService(QdrantClient qdrantClient) {
        this.qdrantClient = qdrantClient;
    }

    public void deleteDocumentVectors(String workspaceId, String documentId) {
        if (workspaceId == null || workspaceId.trim().isEmpty()) {
            throw new IllegalArgumentException("workspaceId must not be blank");
        }
        if (documentId == null || documentId.trim().isEmpty()) {
            throw new IllegalArgumentException("documentId must not be blank");
        }

        log.info("Deleting vectors for document {} in workspace {}", documentId, workspaceId);

        Filter filter = Filter.newBuilder()
                .addMust(Condition.newBuilder()
                        .setField(FieldCondition.newBuilder()
                                .setKey("workspaceId")
                                .setMatch(Match.newBuilder()
                                        .setKeyword(workspaceId)
                                        .build())
                                .build())
                        .build())
                .addMust(Condition.newBuilder()
                        .setField(FieldCondition.newBuilder()
                                .setKey("documentId")
                                .setMatch(Match.newBuilder()
                                        .setKeyword(documentId)
                                        .build())
                                .build())
                        .build())
                .build();

        try {
            qdrantClient.deleteAsync(COLLECTION_NAME, filter).get(10, TimeUnit.SECONDS);
            log.info("Successfully deleted vectors for document {}", documentId);
        } catch (Exception e) {
            log.error("Failed to delete document vectors from Qdrant", e);
            throw new RuntimeException("Failed to delete document vectors: " + e.getMessage(), e);
        }
    }
}
