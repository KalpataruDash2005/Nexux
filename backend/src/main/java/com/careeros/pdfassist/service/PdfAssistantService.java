package com.careeros.pdfassist.service;

import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.pdfassist.config.PdfAssistantProperties;
import com.careeros.pdfassist.dto.PdfChatMessageResponse;
import com.careeros.pdfassist.dto.PdfChatRequest;
import com.careeros.pdfassist.dto.PdfChatResponse;
import com.careeros.pdfassist.dto.PdfDocumentResponse;
import com.careeros.pdfassist.dto.PdfResultRequest;
import com.careeros.pdfassist.dto.PdfUploadResponse;
import com.careeros.pdfassist.entity.PdfChatMessage;
import com.careeros.pdfassist.entity.PdfDocument;
import com.careeros.pdfassist.repository.PdfChatMessageRepository;
import com.careeros.pdfassist.repository.PdfDocumentRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import com.careeros.service.rag.RagServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PdfAssistantService {

    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;

    private final PdfDocumentRepository documentRepository;
    private final PdfChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final PdfAssistantProperties props;
    private final RagServiceClient ragServiceClient;

    // ------------------------------------------------------------------
    // Upload
    // ------------------------------------------------------------------

    public PdfUploadResponse upload(String workspaceId, String ownerEmail, MultipartFile file) {

        User owner = resolveOwner(ownerEmail);
        Workspace workspace = resolveWorkspace(workspaceId, owner);

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was uploaded");
        }

        String originalName = file.getOriginalFilename() == null
                ? "document.pdf"
                : file.getOriginalFilename();

        if (!originalName.toLowerCase().endsWith(".pdf")
                && !originalName.toLowerCase().endsWith(".txt")) {
            throw new BadRequestException("Only PDF and TXT files are supported");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("File is larger than the 25 MB limit");
        }

        /*
         * Generate a unique storage key before saving.
         *
         * Even though RAG service handles the actual file processing,
         * the PdfDocument database entity requires storageKey.
         */
        String storageKey = UUID.randomUUID().toString();

        PdfDocument doc = PdfDocument.builder()
                .workspace(workspace)
                .owner(owner)
                .fileName(originalName)
                .fileSize(file.getSize())
                .contentType(
                        file.getContentType() == null
                                ? "application/pdf"
                                : file.getContentType()
                )
                .storageKey(storageKey)
                .status(PdfDocument.Status.PROCESSING)
                .build();

        // Save document metadata first
        documentRepository.save(doc);

        try {

            log.info(
                    "Uploading document {} to RAG service for workspace {}",
                    doc.getId(),
                    workspaceId
            );

            RagServiceClient.UploadDocumentResponse ragResponse =
                    ragServiceClient.uploadDocument(
                            workspaceId,
                            doc.getId(),
                            file
                    );

            doc.setStatus(PdfDocument.Status.READY);

            if (ragResponse != null) {
                if (ragResponse.getChunksIndexed() != null) {
                    doc.setChunkCount(ragResponse.getChunksIndexed());
                }
                if (ragResponse.getSummary() != null && !ragResponse.getSummary().isBlank()) {
                    doc.setSummary(ragResponse.getSummary());
                }
            }

            // RAG service processed the document
            doc.setProcessingSource(PdfDocument.Source.NATIVE);
            doc.setProcessedAt(LocalDateTime.now());

            documentRepository.save(doc);

            log.info(
                    "Document {} successfully indexed by RAG service",
                    doc.getId()
            );

            return new PdfUploadResponse(
                    doc.getId(),
                    doc.getFileName(),
                    PdfUploadResponse.PdfDocumentStatus.READY,
                    "Document successfully indexed"
            );

        } catch (Exception e) {

            log.error(
                    "Failed to upload document {} to RAG service",
                    doc.getId(),
                    e
            );

            doc.setStatus(PdfDocument.Status.FAILED);
            doc.setErrorMessage(
                    e.getMessage() != null
                            ? e.getMessage()
                            : "Unknown RAG processing error"
            );

            documentRepository.save(doc);

            throw new BadRequestException(
                    "Failed to process document via RAG service: "
                            + e.getMessage()
            );
        }
    }

    // ------------------------------------------------------------------
    // Get / List
    // ------------------------------------------------------------------

    public List<PdfDocumentResponse> listDocuments(
            String workspaceId,
            String ownerEmail
    ) {

        User owner = resolveOwner(ownerEmail);
        Workspace workspace = resolveWorkspace(workspaceId, owner);

        return documentRepository
                .findByWorkspaceIdAndOwnerIdOrderByCreatedAtDesc(
                        workspace.getId(),
                        owner.getId()
                )
                .stream()
                .map(PdfDocumentResponse::from)
                .collect(Collectors.toList());
    }

    public PdfDocumentResponse getDocument(
            String workspaceId,
            String documentId,
            String ownerEmail
    ) {

        PdfDocument doc =
                resolveDocument(
                        workspaceId,
                        documentId,
                        ownerEmail
                );

        return PdfDocumentResponse.from(doc);
    }

    // ------------------------------------------------------------------
    // Chat
    // ------------------------------------------------------------------

    public PdfChatResponse chat(
            String workspaceId,
            String documentId,
            String ownerEmail,
            PdfChatRequest request
    ) {

        PdfDocument doc =
                resolveDocument(
                        workspaceId,
                        documentId,
                        ownerEmail
                );

        User owner = resolveOwner(ownerEmail);

        if (doc.getStatus() != PdfDocument.Status.READY) {
            throw new BadRequestException(
                    "Document is not ready for chat. Status: "
                            + doc.getStatus()
            );
        }

        // Save user message
        PdfChatMessage userMessage =
                PdfChatMessage.builder()
                        .document(doc)
                        .owner(owner)
                        .role(PdfChatMessage.Role.USER)
                        .content(request.question())
                        .build();

        chatMessageRepository.save(userMessage);

        try {

            log.info(
                    "Sending chat request for document {} to RAG service",
                    documentId
            );

            RagServiceClient.AskResponse ragResponse =
                    ragServiceClient.askQuestion(
                            workspaceId,
                            documentId,
                            request.question(),
                            props.getTopK()
                    );

            // Save AI response
            PdfChatMessage aiMessage =
                    PdfChatMessage.builder()
                            .document(doc)
                            .owner(owner)
                            .role(PdfChatMessage.Role.AI)
                            .content(ragResponse.getAnswer())
                            .build();

            chatMessageRepository.save(aiMessage);

            return new PdfChatResponse(
                    ragResponse.getAnswer(),
                    ragResponse.getSources(),
                    history(
                            workspaceId,
                            documentId,
                            ownerEmail
                    )
            );

        } catch (Exception e) {

            log.error(
                    "Chat failed for document {}",
                    documentId,
                    e
            );

            throw new BadRequestException(
                    "Chat query failed: " + e.getMessage()
            );
        }
    }

    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter chatStream(
            String workspaceId,
            String documentId,
            String ownerEmail,
            PdfChatRequest request
    ) {
        PdfDocument doc = resolveDocument(workspaceId, documentId, ownerEmail);
        User owner = resolveOwner(ownerEmail);

        if (doc.getStatus() != PdfDocument.Status.READY) {
            throw new BadRequestException("Document is not ready for chat. Status: " + doc.getStatus());
        }

        PdfChatMessage userMessage = PdfChatMessage.builder()
                .document(doc)
                .owner(owner)
                .role(PdfChatMessage.Role.USER)
                .content(request.question())
                .build();
        chatMessageRepository.save(userMessage);

        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(600000L); // 10 minutes timeout

        StringBuilder aiContentBuilder = new StringBuilder();

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                ragServiceClient.askQuestionStream(
                        workspaceId,
                        documentId,
                        request.question(),
                        props.getTopK(),
                        token -> {
                            aiContentBuilder.append(token);
                            try {
                                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                                String json = mapper.writeValueAsString(java.util.Map.of("token", token));
                                log.info("BACKEND_SENT=[{}] BACKEND_LENGTH={}", token, token.length());
                                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().data(json));
                            } catch (Exception e) {
                                log.error("Failed to send token to frontend", e);
                            }
                        },
                        () -> {
                            try {
                                PdfChatMessage aiMessage = PdfChatMessage.builder()
                                        .document(doc)
                                        .owner(owner)
                                        .role(PdfChatMessage.Role.AI)
                                        .content(aiContentBuilder.toString())
                                        .build();
                                chatMessageRepository.save(aiMessage);
                                emitter.complete();
                            } catch (Exception e) {
                                emitter.completeWithError(e);
                            }
                        },
                        error -> {
                            emitter.completeWithError(error);
                        }
                );
            } catch (Exception e) {
                log.error("Failed to initiate chat stream", e);
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    // ------------------------------------------------------------------
    // Chat History
    // ------------------------------------------------------------------

    public List<PdfChatMessageResponse> history(
            String workspaceId,
            String documentId,
            String ownerEmail
    ) {

        resolveDocument(
                workspaceId,
                documentId,
                ownerEmail
        );

        return chatMessageRepository
                .findByDocumentIdOrderByCreatedAtAsc(documentId)
                .stream()
                .map(PdfChatMessageResponse::from)
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------
    // Delete
    // ------------------------------------------------------------------

    public void delete(
            String workspaceId,
            String documentId,
            String ownerEmail
    ) {

        PdfDocument doc =
                resolveDocument(
                        workspaceId,
                        documentId,
                        ownerEmail
                );

        try {

            ragServiceClient.deleteDocument(
                    workspaceId,
                    documentId
            );

            log.info(
                    "Deleted vectors for document {}",
                    documentId
            );

        } catch (Exception e) {

            log.warn(
                    "Could not delete vectors for document {}: {}",
                    documentId,
                    e.getMessage()
            );
        }

        chatMessageRepository.deleteAll(
                chatMessageRepository
                        .findByDocumentIdOrderByCreatedAtAsc(documentId)
        );

        documentRepository.delete(doc);
    }

    // ------------------------------------------------------------------
    // Internal callback from n8n (Deprecated)
    // ------------------------------------------------------------------

    public PdfDocumentResponse applyInternalResult(
            PdfResultRequest request
    ) {

        log.warn(
                "applyInternalResult is deprecated, routing is now handled synchronously by rag-service."
        );

        return null;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User resolveOwner(String ownerEmail) {

        return userRepository
                .findByEmail(ownerEmail)
                .orElseThrow(
                        () -> new BadRequestException(
                                "User not found"
                        )
                );
    }

    private Workspace resolveWorkspace(
            String workspaceId,
            User owner
    ) {

        return workspaceRepository
                .findByIdAndOwnerId(
                        workspaceId,
                        owner.getId()
                )
                .orElseThrow(
                        () -> new BadRequestException(
                                "Workspace not found or access denied"
                        )
                );
    }

    private PdfDocument resolveDocument(
            String workspaceId,
            String documentId,
            String ownerEmail
    ) {

        User owner = resolveOwner(ownerEmail);

        Workspace workspace =
                resolveWorkspace(
                        workspaceId,
                        owner
                );

        return documentRepository
                .findById(documentId)
                .filter(
                        d -> d.getWorkspace()
                                .getId()
                                .equals(workspace.getId())
                )
                .filter(
                        d -> d.getOwner()
                                .getId()
                                .equals(owner.getId())
                )
                .orElseThrow(
                        () -> new BadRequestException(
                                "Document not found or access denied"
                        )
                );
    }
}