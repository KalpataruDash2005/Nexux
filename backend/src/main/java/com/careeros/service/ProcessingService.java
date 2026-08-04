package com.careeros.service;

import com.careeros.entity.Document;
import com.careeros.repository.DocumentRepository;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingStoreIngestor;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProcessingService {

    private final DocumentRepository documentRepository;
    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;
    private final TextExtractionService textExtractionService;

    @Async
    public void processDocument(String documentId) {
        long startTime = System.currentTimeMillis();
        Document dbDoc = documentRepository.findById(documentId).orElse(null);
        if (dbDoc == null) return;

        try {
            dbDoc.setStatus(Document.Status.EXTRACTING);
            documentRepository.save(dbDoc);

            Path path = Paths.get(dbDoc.getFilePath());
            dev.langchain4j.data.document.Document langchainDoc =
                    textExtractionService.extractDocument(path, dbDoc.getName());
            
            // Add metadata
            langchainDoc.metadata().put("workspace_id", dbDoc.getWorkspace().getId());
            langchainDoc.metadata().put("document_id", dbDoc.getId());
            langchainDoc.metadata().put("document_name", dbDoc.getName());

            dbDoc.setStatus(Document.Status.CHUNKING);
            documentRepository.save(dbDoc);

            // We split manually to count chunks
            var documentSplitter = DocumentSplitters.recursive(1000, 200);
            java.util.List<TextSegment> segments = documentSplitter.split(langchainDoc);

            dbDoc.setStatus(Document.Status.EMBEDDING);
            documentRepository.save(dbDoc);

            EmbeddingStoreIngestor ingestor = EmbeddingStoreIngestor.builder()
                    .embeddingModel(embeddingModel)
                    .embeddingStore(embeddingStore)
                    .build();

            // Insert segments manually or through ingestor
            // Actually it's easier to use the split segments directly to the model and store
            java.util.List<dev.langchain4j.data.embedding.Embedding> embeddings = embeddingModel.embedAll(segments).content();
            
            dbDoc.setStatus(Document.Status.INDEXING);
            documentRepository.save(dbDoc);
            
            embeddingStore.addAll(embeddings, segments);

            // Update Metadata
            dbDoc.setChunkCount(segments.size());
            dbDoc.setPages(langchainDoc.metadata().getInteger("page_count")); // If available
            dbDoc.setLanguage(langchainDoc.metadata().getString("language")); // If available
            dbDoc.setProcessingTimeMs(System.currentTimeMillis() - startTime);

            dbDoc.setStatus(Document.Status.READY);
            documentRepository.save(dbDoc);
            log.info("Successfully processed document: {} in {} ms with {} chunks", documentId, dbDoc.getProcessingTimeMs(), segments.size());

        } catch (Exception e) {
            log.error("Failed to process document: {}", documentId, e);
            dbDoc.setStatus(Document.Status.FAILED);
            documentRepository.save(dbDoc);
        }
    }
}
