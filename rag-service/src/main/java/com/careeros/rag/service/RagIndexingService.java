package com.careeros.rag.service;

import com.careeros.rag.dto.IndexRequest;
import com.careeros.rag.dto.IndexResponse;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import io.qdrant.client.QdrantClient;
import io.qdrant.client.grpc.Collections.Distance;
import io.qdrant.client.grpc.Collections.VectorParams;
import io.qdrant.client.grpc.Points.PointStruct;
import io.qdrant.client.grpc.JsonWithInt.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class RagIndexingService {

    private static final Logger log = LoggerFactory.getLogger(RagIndexingService.class);
    private static final String COLLECTION_NAME = "careeros_chunks";
    private static final int EMBEDDING_DIMENSION = 384;

    private final TextChunkingService chunkingService;
    private final EmbeddingModel embeddingModel;
    private final QdrantClient qdrantClient;
    private final RagDocumentService documentService;

    public RagIndexingService(TextChunkingService chunkingService,
                              EmbeddingModel embeddingModel,
                              QdrantClient qdrantClient,
                              RagDocumentService documentService) {
        this.chunkingService = chunkingService;
        this.embeddingModel = embeddingModel;
        this.qdrantClient = qdrantClient;
        this.documentService = documentService;
    }

    public void ensureCollection() {
        try {
            List<String> collections = qdrantClient.listCollectionsAsync().get(10, TimeUnit.SECONDS);
            if (!collections.contains(COLLECTION_NAME)) {
                VectorParams params = VectorParams.newBuilder()
                        .setSize(EMBEDDING_DIMENSION)
                        .setDistance(Distance.Cosine)
                        .build();
                qdrantClient.createCollectionAsync(COLLECTION_NAME, params).get(10, TimeUnit.SECONDS);
            }
            
            // Create payload index for workspaceId (idempotent, works even if collection/index already exists)
            qdrantClient.createPayloadIndexAsync(
                    COLLECTION_NAME,
                    "workspaceId",
                    io.qdrant.client.grpc.Collections.PayloadSchemaType.Keyword,
                    io.qdrant.client.grpc.Collections.PayloadIndexParams.newBuilder().build(),
                    true,
                    null,
                    null
            ).get(10, TimeUnit.SECONDS);

            // Create payload index for documentId
            qdrantClient.createPayloadIndexAsync(
                    COLLECTION_NAME,
                    "documentId",
                    io.qdrant.client.grpc.Collections.PayloadSchemaType.Keyword,
                    io.qdrant.client.grpc.Collections.PayloadIndexParams.newBuilder().build(),
                    true,
                    null,
                    null
            ).get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new RuntimeException("Failed to ensure Qdrant collection: " + e.getMessage(), e);
        }
    }

    public IndexResponse indexDocument(IndexRequest request) {
        if (request.getWorkspaceId() == null || request.getWorkspaceId().trim().isEmpty()) {
            throw new IllegalArgumentException("workspaceId must not be blank");
        }
        if (request.getDocumentId() == null || request.getDocumentId().trim().isEmpty()) {
            throw new IllegalArgumentException("documentId must not be blank");
        }
        if (request.getText() == null || request.getText().trim().isEmpty()) {
            throw new IllegalArgumentException("text must not be blank");
        }

        log.info("Starting indexing for document {} in workspace {}", request.getDocumentId(), request.getWorkspaceId());

        // Ensure collection exists when indexing is requested
        ensureCollection();

        // Safe re-indexing: Delete existing vectors for this document
        documentService.deleteDocumentVectors(request.getWorkspaceId(), request.getDocumentId());

        List<TextSegment> segments = chunkingService.chunkText(request.getText());
        if (segments.isEmpty()) {
            log.info("No text segments produced for document {}", request.getDocumentId());
            IndexResponse res = new IndexResponse();
            res.setStatus("SUCCESS");
            res.setWorkspaceId(request.getWorkspaceId());
            res.setDocumentId(request.getDocumentId());
            res.setChunksIndexed(0);
            return res;
        }

        List<PointStruct> points = new ArrayList<>();
        int chunkIndex = 0;

        for (TextSegment segment : segments) {
            Embedding embedding = embeddingModel.embed(segment.text()).content();

            Map<String, Value> payload = Map.of(
                    "workspaceId", io.qdrant.client.ValueFactory.value(request.getWorkspaceId()),
                    "documentId", io.qdrant.client.ValueFactory.value(request.getDocumentId()),
                    "chunkIndex", io.qdrant.client.ValueFactory.value((long)chunkIndex),
                    "text", io.qdrant.client.ValueFactory.value(segment.text())
            );

            PointStruct point = PointStruct.newBuilder()
                    .setId(io.qdrant.client.PointIdFactory.id(UUID.randomUUID()))
                    .setVectors(io.qdrant.client.VectorsFactory.vectors(embedding.vector()))
                    .putAllPayload(payload)
                    .build();
            
            points.add(point);
            chunkIndex++;
        }

        try {
            qdrantClient.upsertAsync(COLLECTION_NAME, points).get(10, TimeUnit.SECONDS);
            log.info("Successfully indexed {} chunks for document {}", points.size(), request.getDocumentId());
        } catch (Exception e) {
            log.error("Failed to index chunks into Qdrant", e);
            throw new RuntimeException("Failed to index chunks into Qdrant: " + e.getMessage(), e);
        }

        IndexResponse res = new IndexResponse();
        res.setStatus("SUCCESS");
        res.setWorkspaceId(request.getWorkspaceId());
        res.setDocumentId(request.getDocumentId());
        res.setChunksIndexed(points.size());
        return res;
    }
}
