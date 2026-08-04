package com.careeros.service;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.filter.Filter;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SemanticSearchService {

    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;

    public List<SearchResultDto> search(String workspaceId, String query, int maxResults) {
        dev.langchain4j.data.embedding.Embedding queryEmbedding = embeddingModel.embed(query).content();
        Filter workspaceFilter = MetadataFilterBuilder.metadataKey("workspace_id").isEqualTo(workspaceId);

        EmbeddingSearchRequest request = EmbeddingSearchRequest.builder()
                .queryEmbedding(queryEmbedding)
                .maxResults(maxResults)
                .minScore(0.5)
                .filter(workspaceFilter)
                .build();

        EmbeddingSearchResult<TextSegment> result = embeddingStore.search(request);

        return result.matches().stream().map(match -> SearchResultDto.builder()
                .content(match.embedded().text())
                .score(match.score())
                .documentId(match.embedded().metadata().getString("document_id"))
                .documentName(match.embedded().metadata().getString("document_name"))
                .build()
        ).collect(Collectors.toList());
    }

    @Data
    @Builder
    public static class SearchResultDto {
        private String content;
        private Double score;
        private String documentId;
        private String documentName;
    }
}
