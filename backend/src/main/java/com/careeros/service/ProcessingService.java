package com.careeros.service;

import com.careeros.entity.Document;
import com.careeros.repository.DocumentRepository;
import com.careeros.service.rag.RagServiceClient;
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
    private final RagServiceClient ragServiceClient;

    @Async
    public void processDocument(String documentId) {
        long startTime = System.currentTimeMillis();
        Document dbDoc = documentRepository.findById(documentId).orElse(null);
        if (dbDoc == null) return;

        try {
            dbDoc.setStatus(Document.Status.INDEXING);
            documentRepository.save(dbDoc);

            Path path = Paths.get(dbDoc.getFilePath());
            
            // Call rag-service to handle extraction, chunking, and indexing
            RagServiceClient.UploadDocumentResponse response = ragServiceClient.uploadDocument(
                dbDoc.getWorkspace().getId(),
                dbDoc.getId(),
                path,
                dbDoc.getName()
            );

            // Update Metadata
            if (response.getChunksIndexed() != null) {
                dbDoc.setChunkCount(response.getChunksIndexed());
            }
            dbDoc.setProcessingTimeMs(System.currentTimeMillis() - startTime);

            dbDoc.setStatus(Document.Status.READY);
            documentRepository.save(dbDoc);
            log.info("Successfully processed document via rag-service: {} in {} ms with {} chunks", 
                documentId, dbDoc.getProcessingTimeMs(), dbDoc.getChunkCount());

        } catch (Exception e) {
            log.error("Failed to process document via rag-service: {}", documentId, e);
            dbDoc.setStatus(Document.Status.FAILED);
            documentRepository.save(dbDoc);
        }
    }
}
