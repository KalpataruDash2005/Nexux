package com.careeros.rag.service;

import com.careeros.rag.dto.SearchRequest;
import com.careeros.rag.dto.SearchResponse;
import com.careeros.rag.dto.SearchResult;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.model.embedding.EmbeddingModel;
import io.qdrant.client.QdrantClient;
import io.qdrant.client.grpc.Points.Condition;
import io.qdrant.client.grpc.Points.FieldCondition;
import io.qdrant.client.grpc.Points.Filter;
import io.qdrant.client.grpc.Points.Match;
import io.qdrant.client.grpc.Points.ScoredPoint;
import io.qdrant.client.grpc.Points.SearchPoints;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
public class RagSearchService {

    private static final Logger log = LoggerFactory.getLogger(RagSearchService.class);
    private static final String COLLECTION_NAME = "careeros_chunks";

    private final EmbeddingModel embeddingModel;
    private final QdrantClient qdrantClient;

    @Value("${app.rag.min-score:0.7}")
    private float minScore;

    public RagSearchService(EmbeddingModel embeddingModel, QdrantClient qdrantClient) {
        this.embeddingModel = embeddingModel;
        this.qdrantClient = qdrantClient;
    }

    private SearchResult mapResult(ScoredPoint point) {
        SearchResult result = new SearchResult();
        result.setScore(point.getScore());
        if (point.getPayloadMap().containsKey("text")) {
            result.setText(point.getPayloadMap().get("text").getStringValue());
        }
        if (point.getPayloadMap().containsKey("documentId")) {
            result.setDocumentId(point.getPayloadMap().get("documentId").getStringValue());
        }
        if (point.getPayloadMap().containsKey("chunkIndex")) {
            result.setChunkIndex((int) point.getPayloadMap().get("chunkIndex").getIntegerValue());
        }
        return result;
    }

    public SearchResponse search(SearchRequest request) {
        if (request.getWorkspaceId() == null || request.getWorkspaceId().trim().isEmpty()) {
            throw new IllegalArgumentException("workspaceId must not be blank");
        }
        if (request.getQuery() == null || request.getQuery().trim().isEmpty()) {
            throw new IllegalArgumentException("query must not be blank");
        }
        int topK = request.getTopK() != null ? request.getTopK() : 5;
        if (topK <= 0) {
            throw new IllegalArgumentException("topK must be greater than 0");
        }
        if (topK > 20) {
            throw new IllegalArgumentException("topK must not exceed 20");
        }

        boolean isBroadQuery = "BROAD_DOCUMENT".equals(request.getQuestionType());
        String strategy = "STRICT";
        
        

        log.info("QUERY = {}", request.getQuery());
        log.info("WORKSPACE_ID = {}", request.getWorkspaceId());
        log.info("DOCUMENT_ID = {}", request.getDocumentId());
        log.info("QUESTION_TYPE = {}", request.getQuestionType());
        log.info("QUESTION_COMPLEXITY = {}", request.getQuestionComplexity());
        log.info("Searching for query in workspace {} with topK {} (minScore: {})", request.getWorkspaceId(), topK, minScore);
        
        long embStart = System.currentTimeMillis();
        Embedding queryEmbedding = embeddingModel.embed(request.getQuery()).content();
        long embTime = System.currentTimeMillis() - embStart;
        log.info("QUERY_EMBEDDING_TIME_MS = {}", embTime);

        List<Float> vectorList = new ArrayList<>(queryEmbedding.vector().length);
        for (float f : queryEmbedding.vector()) {
            vectorList.add(f);
        }

        Filter.Builder filterBuilder = Filter.newBuilder()
                .addMust(Condition.newBuilder()
                        .setField(FieldCondition.newBuilder()
                                .setKey("workspaceId")
                                .setMatch(Match.newBuilder()
                                        .setKeyword(request.getWorkspaceId())
                                        .build())
                                .build())
                        .build());
                        
        if (request.getDocumentId() != null && !request.getDocumentId().trim().isEmpty()) {
            filterBuilder.addMust(Condition.newBuilder()
                    .setField(FieldCondition.newBuilder()
                            .setKey("documentId")
                            .setMatch(Match.newBuilder()
                                    .setKeyword(request.getDocumentId())
                                    .build())
                            .build())
                    .build());
        }

        int searchLimit = isBroadQuery ? Math.max(12, topK) : topK;

        SearchPoints searchPoints = SearchPoints.newBuilder()
                .setCollectionName(COLLECTION_NAME)
                .addAllVector(vectorList)
                .setFilter(filterBuilder.build())
                .setLimit(searchLimit * 2) // Extra buffer for dedup
                .setWithPayload(io.qdrant.client.WithPayloadSelectorFactory.enable(true))
                .build();

        List<ScoredPoint> qdrantResults;
        try {
            qdrantResults = qdrantClient.searchAsync(searchPoints).get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new RuntimeException("Failed to search Qdrant: " + e.getMessage(), e);
        }
        
        List<SearchResult> results = new ArrayList<>();
        Set<Integer> seenChunks = new HashSet<>();

        
        if (isBroadQuery) {
            strategy = "BROAD_DOCUMENT";
            for (ScoredPoint point : qdrantResults) {
                SearchResult res = mapResult(point);
                if (!seenChunks.contains(res.getChunkIndex())) {
                    results.add(res);
                    seenChunks.add(res.getChunkIndex());
                }
                if (results.size() >= searchLimit) break;
            }
        } else {
            boolean addedRelaxed = false;
            // STRICT semantic search
            for (ScoredPoint point : qdrantResults) {
                if (point.getScore() >= minScore) {
                    SearchResult res = mapResult(point);
                    if (!seenChunks.contains(res.getChunkIndex())) {
                        results.add(res);
                        seenChunks.add(res.getChunkIndex());
                    }
                    if (results.size() >= searchLimit) break;
                }
            }
            
            // Supplement with relaxed if we have room, but ONLY if reasonable relevance (>= 0.5f)
            for (ScoredPoint point : qdrantResults) {
                if (point.getScore() >= 0.5f && point.getScore() < minScore) {
                    SearchResult res = mapResult(point);
                    if (!seenChunks.contains(res.getChunkIndex())) {
                        results.add(res);
                        seenChunks.add(res.getChunkIndex());
                        addedRelaxed = true;
                    }
                    if (results.size() >= searchLimit) break;
                }
            }
            
            // If genuinely empty, fall back to weak relevance (>= 0.3f) just to not fail completely
            if (results.isEmpty()) {
                for (ScoredPoint point : qdrantResults) {
                    if (point.getScore() >= 0.3f && point.getScore() < 0.5f) {
                        SearchResult res = mapResult(point);
                        if (!seenChunks.contains(res.getChunkIndex())) {
                            results.add(res);
                            seenChunks.add(res.getChunkIndex());
                            addedRelaxed = true;
                        }
                        if (results.size() >= searchLimit) break;
                    }
                }
            }

            if (!results.isEmpty()) {
                strategy = addedRelaxed ? "STRICT_PLUS_RELAXED" : "STRICT";
            } else if (request.getDocumentId() != null && !request.getDocumentId().trim().isEmpty()) {
                // Genuine fallback: no relevant chunks exist at all
                strategy = "DOCUMENT_FALLBACK";
                SearchPoints fallbackPoints = SearchPoints.newBuilder()
                        .setCollectionName(COLLECTION_NAME)
                        .addAllVector(vectorList)
                        .setFilter(filterBuilder.build())
                        .setLimit(searchLimit)
                        .setWithPayload(io.qdrant.client.WithPayloadSelectorFactory.enable(true))
                        .build();
                try {
                    List<ScoredPoint> fallbackResults = qdrantClient.searchAsync(fallbackPoints).get(10, TimeUnit.SECONDS);
                    for (ScoredPoint point : fallbackResults) {
                        SearchResult res = mapResult(point);
                        if (!seenChunks.contains(res.getChunkIndex())) {
                            results.add(res);
                            seenChunks.add(res.getChunkIndex());
                        }
                        if (results.size() >= searchLimit) break;
                    }
                } catch (Exception e) {
                    log.error("DOCUMENT_FALLBACK search failed", e);
                }
            }
        }

        double minSelectedScore = Double.MAX_VALUE;
        double totalSelectedScore = 0.0;
        for (SearchResult res : results) {
            double score = res.getScore();
            if (score < minSelectedScore) {
                minSelectedScore = score;
            }
            totalSelectedScore += score;
        }
        double avgScore = results.isEmpty() ? 0.0 : totalSelectedScore / results.size();
        if (minSelectedScore == Double.MAX_VALUE) minSelectedScore = 0.0;

        log.info("FINAL_SELECTED_CONTEXT_COUNT = {}", results.size());
        log.info("FINAL_CONTEXT_STRATEGY = {}", strategy);
        log.info("AVERAGE_SELECTED_SCORE = {}", avgScore);
        log.info("LOWEST_SELECTED_SCORE = {}", minSelectedScore);
        
        for (SearchResult res : results) {
            log.info("SELECTED_CHUNK_INDEX = {}, SELECTED_CHUNK_SCORE = {}", res.getChunkIndex(), res.getScore());
        }

        SearchResponse response = new SearchResponse();
        response.setStatus("SUCCESS");
        response.setStrategy(strategy);
        response.setResults(results);
        return response;

    }
}
