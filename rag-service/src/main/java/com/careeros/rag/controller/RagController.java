package com.careeros.rag.controller;

import com.careeros.rag.dto.IndexRequest;
import com.careeros.rag.dto.IndexResponse;
import com.careeros.rag.dto.SearchRequest;
import com.careeros.rag.dto.SearchResponse;
import com.careeros.rag.service.RagIndexingService;
import com.careeros.rag.service.RagSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping(value = "/api/rag", produces = "application/json")
public class RagController {

    private final RagIndexingService indexingService;
    private final RagSearchService searchService;
    private final com.careeros.rag.service.RagAnswerService ragAnswerService;
    private final com.careeros.rag.service.DocumentExtractionService documentExtractionService;
    private final com.careeros.rag.service.RagDocumentService documentService;
    private final dev.langchain4j.model.chat.ChatLanguageModel chatLanguageModel;

    public RagController(RagIndexingService indexingService, RagSearchService searchService, com.careeros.rag.service.RagAnswerService ragAnswerService, com.careeros.rag.service.DocumentExtractionService documentExtractionService, com.careeros.rag.service.RagDocumentService documentService, dev.langchain4j.model.chat.ChatLanguageModel chatLanguageModel) {
        this.indexingService = indexingService;
        this.searchService = searchService;
        this.ragAnswerService = ragAnswerService;
        this.documentExtractionService = documentExtractionService;
        this.documentService = documentService;
        this.chatLanguageModel = chatLanguageModel;
    }

    @PostMapping("/index")
    public ResponseEntity<IndexResponse> index(@RequestBody IndexRequest request) {
        IndexResponse response = indexingService.indexDocument(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/search")
    public ResponseEntity<SearchResponse> search(@RequestBody SearchRequest request) {
        SearchResponse response = searchService.search(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/ask")
    public ResponseEntity<com.careeros.rag.dto.AskResponse> ask(@RequestBody com.careeros.rag.dto.AskRequest request) {
        com.careeros.rag.dto.AskResponse response = ragAnswerService.ask(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/ask/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter askStream(@RequestBody com.careeros.rag.dto.AskRequest request) {
        return ragAnswerService.askStream(request);
    }

    @PostMapping("/documents/upload")
    public ResponseEntity<com.careeros.rag.dto.UploadDocumentResponse> uploadDocument(
            @RequestParam("workspaceId") String workspaceId,
            @RequestParam("documentId") String documentId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        if (workspaceId == null || workspaceId.trim().isEmpty()) {
            throw new IllegalArgumentException("workspaceId must not be blank");
        }
        if (documentId == null || documentId.trim().isEmpty()) {
            throw new IllegalArgumentException("documentId must not be blank");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file must not be empty");
        }

        // Extract text
        String extractedText = documentExtractionService.extractText(file);

        // Index extracted text
        IndexRequest indexReq = new IndexRequest();
        indexReq.setWorkspaceId(workspaceId);
        indexReq.setDocumentId(documentId);
        indexReq.setText(extractedText);

        IndexResponse indexRes = indexingService.indexDocument(indexReq);

        String summary = null;
        try {
            int maxLen = Math.min(extractedText.length(), 4000);
            String summaryContext = extractedText.substring(0, maxLen);
            String prompt = "Please provide a concise 2-3 sentence summary of the following document:\n\n" + summaryContext;
            dev.langchain4j.data.message.AiMessage aiMessage = chatLanguageModel.generate(dev.langchain4j.data.message.UserMessage.from(prompt)).content();
            summary = aiMessage.text();
        } catch (Exception e) {
            // Ignore error so that indexing still succeeds even if summarization fails
            System.err.println("Failed to generate summary: " + e.getMessage());
        }

        // Build response
        com.careeros.rag.dto.UploadDocumentResponse response = new com.careeros.rag.dto.UploadDocumentResponse();
        response.setStatus("SUCCESS");
        response.setWorkspaceId(workspaceId);
        response.setDocumentId(documentId);
        response.setFileName(file.getOriginalFilename());
        response.setExtractedCharacters(extractedText.length());
        response.setChunksIndexed(indexRes.getChunksIndexed());
        response.setSummary(summary);

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Map<String, String>> deleteDocument(
            @PathVariable("documentId") String documentId,
            @RequestParam("workspaceId") String workspaceId) {
        if (workspaceId == null || workspaceId.trim().isEmpty()) {
            throw new IllegalArgumentException("workspaceId must not be blank");
        }
        if (documentId == null || documentId.trim().isEmpty()) {
            throw new IllegalArgumentException("documentId must not be blank");
        }

        // Injecting service to delete vectors
        documentService.deleteDocumentVectors(workspaceId, documentId);

        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "workspaceId", workspaceId,
                "documentId", documentId,
                "message", "Document vectors deleted successfully"
        ));
    }
}
