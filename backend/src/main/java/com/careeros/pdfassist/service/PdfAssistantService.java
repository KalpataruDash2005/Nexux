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
import com.careeros.service.TextExtractionService;
import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.Filter;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import io.qdrant.client.QdrantClient;
import io.qdrant.client.QdrantGrpcClient;
import io.qdrant.client.grpc.Collections.Distance;
import io.qdrant.client.grpc.Collections.VectorParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PdfAssistantService {

    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;
    private static final int LLM_MAX_RETRIES = 3;

    private final PdfDocumentRepository documentRepository;
    private final PdfChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final TextExtractionService textExtractionService;
    private final PdfAssistantProperties props;
    private final RestClient.Builder restClientBuilder;
    private final EmbeddingModel embeddingModel;

    private volatile ChatLanguageModel chatModel;

    // ------------------------------------------------------------------
    // Upload
    // ------------------------------------------------------------------

    public PdfUploadResponse upload(String workspaceId, String ownerEmail, MultipartFile file) {
        User owner = resolveOwner(ownerEmail);
        Workspace workspace = resolveWorkspace(workspaceId, owner);

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was uploaded");
        }
        String originalName = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
        if (!originalName.toLowerCase().endsWith(".pdf")) {
            throw new BadRequestException("Only PDF files are supported");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("File is larger than the 25 MB limit");
        }

        PdfDocument doc = PdfDocument.builder()
                .workspace(workspace)
                .owner(owner)
                .fileName(originalName)
                .fileSize(file.getSize())
                .contentType(file.getContentType() == null ? "application/pdf" : file.getContentType())
                .status(PdfDocument.Status.PENDING)
                .build();

        Path storageRoot = Paths.get(props.getStorageDir(), workspaceId);
        Path target = storageRoot.resolve(doc.getId() + ".pdf");
        try {
            Files.createDirectories(storageRoot);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Failed to persist uploaded PDF for document {}", doc.getId(), e);
            throw new BadRequestException("Failed to store the uploaded file: " + e.getMessage());
        }

        doc.setStorageKey(target.toAbsolutePath().toString());
        documentRepository.save(doc);

        processAfterUpload(doc.getId());
        return new PdfUploadResponse(doc.getId(), doc.getFileName(), PdfUploadResponse.PdfDocumentStatus.PENDING,
                "Document accepted and processing started");
    }

    /**
     * Triggers the n8n pipeline when available, otherwise falls back to the
     * native backend pipeline so the feature keeps working without Docker.
     */
    @Async
    public void processAfterUpload(String documentId) {
        PdfDocument doc = documentRepository.findById(documentId).orElse(null);
        if (doc == null) {
            log.warn("processAfterUpload: document {} not found", documentId);
            return;
        }
        if (doc.getStatus() == PdfDocument.Status.READY || doc.getStatus() == PdfDocument.Status.FAILED) {
            return;
        }
        doc.setStatus(PdfDocument.Status.PROCESSING);
        doc.setErrorMessage(null);
        documentRepository.save(doc);

        if (props.isN8nEnabled()) {
            try {
                triggerN8nProcess(doc);
                return; // n8n will POST the result back to the internal endpoint
            } catch (Exception e) {
                log.warn("n8n PDF pipeline unreachable for document {}, falling back to native: {}",
                        documentId, e.getMessage());
            }
        }

        try {
            processNative(documentId);
        } catch (Exception e) {
            log.error("Native PDF processing failed for document {}", documentId, e);
            markFailed(documentId, "Native processing failed: " + safeMessage(e));
        }
    }

    private void triggerN8nProcess(PdfDocument doc) {
        String url = props.getN8nWebhookUrl() + "/webhook/pdf-process";
        Map<String, Object> body = Map.of(
                "documentId", doc.getId(),
                "workspaceId", doc.getWorkspace().getId(),
                "fileName", doc.getFileName(),
                "filePath", doc.getStorageKey(),
                "storageKey", doc.getStorageKey()
        );
        restClientBuilder.build()
                .post()
                .uri(url)
                .header("X-Internal-Key", props.getInternalKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    // ------------------------------------------------------------------
    // Native processing (fallback / n8n disabled)
    // ------------------------------------------------------------------

    public void processNative(String documentId) throws Exception {
        PdfDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new BadRequestException("Document not found"));
        doc.setStatus(PdfDocument.Status.PROCESSING);
        doc.setProcessingSource(PdfDocument.Source.NATIVE);
        documentRepository.save(doc);

        Document extracted = textExtractionService.extractDocument(Path.of(doc.getStorageKey()), doc.getFileName());
        if (extracted == null || extracted.text() == null || extracted.text().isBlank()) {
            throw new BadRequestException("No readable text could be extracted from this PDF");
        }

        extracted.metadata().put("workspace_id", doc.getWorkspace().getId());
        extracted.metadata().put("document_id", doc.getId());
        extracted.metadata().put("document_name", doc.getFileName());

        List<TextSegment> segments = DocumentSplitters.recursive(props.getChunkSize(), props.getChunkOverlap())
                .split(extracted);
        if (segments.isEmpty()) {
            throw new BadRequestException("No content chunks could be created from this PDF");
        }

        List<Embedding> embeddings = embeddingModel.embedAll(segments).content();
        ensurePdfCollection();
        EmbeddingStore<TextSegment> pdfStore = pdfEmbeddingStore();
        pdfStore.addAll(embeddings, segments);
        log.info("Native processing: stored {} chunks for document {}", segments.size(), documentId);

        String summary = buildSummary(extracted.text());

        doc.setSummary(summary);
        doc.setChunkCount(segments.size());
        doc.setProcessingSource(PdfDocument.Source.NATIVE);
        doc.setStatus(PdfDocument.Status.READY);
        doc.setProcessedAt(LocalDateTime.now());
        documentRepository.save(doc);
    }

    private String buildSummary(String text) {
        String excerpt = text.length() > 6000 ? text.substring(0, 6000) : text;
        String prompt = """
                You are a friendly, patient study buddy helping a student review their uploaded PDF.

                Summarize the document in a way that actually helps them learn. Write in flowing markdown with short headings and bullet lists, and:

                - Start with a 1-2 sentence plain-English overview of what the document is about.
                - Then a "Key Points" section with 4-7 bullets capturing the most important ideas, defining any important terms in simple words as you go.
                - Then an "Important Details" section with a few bullets for specifics worth remembering (numbers, definitions, formulas, examples, names).
                - Keep everything faithful to the document. Never invent facts that aren't there.
                - Use a natural, conversational tone — imagine a helpful senior explaining it to you, not a corporate document.

                Document text:
                %s
                """.formatted(excerpt);
        return generateLlm(prompt);
    }

    // ------------------------------------------------------------------
    // Chat (native RAG)
    // ------------------------------------------------------------------

    public PdfChatResponse chat(String workspaceId, String documentId, String ownerEmail, PdfChatRequest request) {
        String question = request == null || request.question() == null ? "" : request.question().trim();
        if (question.isBlank()) {
            throw new BadRequestException("Question must not be empty");
        }
        PdfDocument doc = resolveDocument(workspaceId, documentId, ownerEmail);

        chatMessageRepository.save(PdfChatMessage.builder()
                .document(doc)
                .owner(doc.getOwner())
                .role(PdfChatMessage.Role.USER)
                .content(question)
                .build());

        String answer;
        List<String> sources = new ArrayList<>();
        try {
            Embedding questionEmbedding = embeddingModel.embed(question).content();
            Filter filter = MetadataFilterBuilder.metadataKey("document_id").isEqualTo(documentId);
            EmbeddingSearchRequest searchRequest = EmbeddingSearchRequest.builder()
                    .queryEmbedding(questionEmbedding)
                    .maxResults(props.getTopK())
                    .minScore(props.getMinScore())
                    .filter(filter)
                    .build();

            EmbeddingSearchResult<TextSegment> result = pdfEmbeddingStore().search(searchRequest);

            if (result.matches().isEmpty()) {
                answer = "I couldn't find this information in the uploaded document.";
            } else {
                String context = result.matches().stream()
                        .map(match -> {
                            sources.add(doc.getFileName());
                            String page = match.embedded().metadata().getString("page");
                            String prefix = (page != null && !page.isBlank()) ? "[page " + page + "]\n" : "";
                            return prefix + match.embedded().text();
                        })
                        .collect(Collectors.joining("\n\n"));
                if (context.length() > 8000) {
                    context = context.substring(0, 8000) + "...";
                }
                answer = generateLlm("""
                        You are a warm, patient study buddy and academic tutor.

                        Answer the student's question in a clear, well-organized way that helps them truly understand the topic.

                        Guidelines:
                        - Base your answer ONLY on the context below, which comes from their uploaded PDF. Never invent facts.
                        - Explain step by step, define any jargon in plain language, and use a concrete example or short analogy when it helps.
                        - Structure the answer with short paragraphs or a few bullet points so it's easy to read.
                        - Answer the actual question first, then elaborate and connect the ideas.
                        - If the context does not contain the answer, say so honestly and suggest what they could upload or ask next.
                        - Keep a natural, friendly, human tone — like a helpful senior explaining it over a coffee. No corporate or robotic phrasing.

                        Context from the document:
                        %s

                        Student's question: %s
                        """.formatted(context, question));
            }
        } catch (Exception e) {
            log.warn("PDF chat retrieval failed for document {}, returning fallback message: {}",
                    documentId, e.getMessage());
            answer = "I'm unable to answer right now because the vector index is unavailable. "
                    + "Please try again in a moment.";
        }

        PdfChatMessage aiMessage = chatMessageRepository.save(PdfChatMessage.builder()
                .document(doc)
                .owner(doc.getOwner())
                .role(PdfChatMessage.Role.AI)
                .content(answer)
                .build());

        List<PdfChatMessageResponse> history = chatMessageRepository.findByDocumentIdOrderByCreatedAtAsc(documentId)
                .stream()
                .map(PdfChatMessageResponse::from)
                .collect(Collectors.toList());
        return new PdfChatResponse(answer, sources, history);
    }

    public List<PdfChatMessageResponse> history(String workspaceId, String documentId, String ownerEmail) {
        resolveDocument(workspaceId, documentId, ownerEmail);
        return chatMessageRepository.findByDocumentIdOrderByCreatedAtAsc(documentId)
                .stream()
                .map(PdfChatMessageResponse::from)
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------
    // Documents
    // ------------------------------------------------------------------

    public List<PdfDocumentResponse> listDocuments(String workspaceId, String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        return documentRepository.findByWorkspaceIdAndOwnerIdOrderByCreatedAtDesc(workspaceId, owner.getId())
                .stream()
                .map(PdfDocumentResponse::from)
                .collect(Collectors.toList());
    }

    public PdfDocumentResponse getDocument(String workspaceId, String documentId, String ownerEmail) {
        return PdfDocumentResponse.from(resolveDocument(workspaceId, documentId, ownerEmail));
    }

    // ------------------------------------------------------------------
    // Delete
    // ------------------------------------------------------------------

    public void delete(String workspaceId, String documentId, String ownerEmail) {
        PdfDocument doc = resolveDocument(workspaceId, documentId, ownerEmail);

        if (props.isN8nEnabled()) {
            try {
                restClientBuilder.build()
                        .post()
                        .uri(props.getN8nWebhookUrl() + "/webhook/pdf-delete")
                        .header("X-Internal-Key", props.getInternalKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("documentId", documentId, "workspaceId", workspaceId))
                        .retrieve()
                        .toBodilessEntity();
            } catch (Exception e) {
                log.warn("n8n delete pipeline unreachable for document {} (native cleanup will run): {}",
                        documentId, e.getMessage());
            }
        }

        try {
            deletePdfVectors(documentId);
        } catch (Exception e) {
            log.warn("Could not delete vectors for document {}: {}", documentId, e.getMessage());
        }

        try {
            Files.deleteIfExists(Path.of(doc.getStorageKey()));
        } catch (Exception ignored) {
            // best effort cleanup of the stored file
        }

        chatMessageRepository.deleteAll(chatMessageRepository.findByDocumentIdOrderByCreatedAtAsc(documentId));
        documentRepository.delete(doc);
    }

    // ------------------------------------------------------------------
    // Internal callback from n8n
    // ------------------------------------------------------------------

    public PdfDocumentResponse applyInternalResult(PdfResultRequest request) {
        if (request == null || request.documentId() == null || request.documentId().isBlank()) {
            throw new BadRequestException("documentId is required");
        }
        PdfDocument doc = documentRepository.findById(request.documentId()).orElse(null);
        if (doc == null) {
            log.warn("Internal result received for unknown document {}", request.documentId());
            return null;
        }

        PdfDocument.Status status = request.status() == null ? PdfDocument.Status.READY : request.status();
        doc.setStatus(status);
        doc.setProcessingSource("n8n".equalsIgnoreCase(request.source())
                ? PdfDocument.Source.N8N
                : PdfDocument.Source.NATIVE);
        doc.setChunkCount(request.chunkCount());
        doc.setErrorMessage(request.error());
        if (request.summary() != null && !request.summary().isBlank()) {
            doc.setSummary(request.summary());
        }
        doc.setProcessedAt(LocalDateTime.now());
        documentRepository.save(doc);
        log.info("Internal result applied for document {} -> {}", doc.getId(), status);
        return PdfDocumentResponse.from(doc);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User resolveOwner(String ownerEmail) {
        return userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    private Workspace resolveWorkspace(String workspaceId, User owner) {
        return workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));
    }

    private PdfDocument resolveDocument(String workspaceId, String documentId, String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        Workspace workspace = resolveWorkspace(workspaceId, owner);
        return documentRepository.findById(documentId)
                .filter(d -> d.getWorkspace().getId().equals(workspace.getId()))
                .filter(d -> d.getOwner().getId().equals(owner.getId()))
                .orElseThrow(() -> new BadRequestException("Document not found or access denied"));
    }

    private void markFailed(String documentId, String message) {
        documentRepository.findById(documentId).ifPresent(doc -> {
            doc.setStatus(PdfDocument.Status.FAILED);
            doc.setErrorMessage(message);
            documentRepository.save(doc);
        });
    }

    private EmbeddingStore<TextSegment> pdfEmbeddingStore() {
        return QdrantEmbeddingStore.builder()
                .host(props.getQdrantHost())
                .port(props.getQdrantPort())
                .collectionName(props.getQdrantCollection())
                .build();
    }

    private void ensurePdfCollection() {
        QdrantClient client = null;
        try {
            client = new QdrantClient(
                    QdrantGrpcClient.newBuilder(props.getQdrantHost(), props.getQdrantPort(), true)
                            .apiKey(props.getQdrantApiKey())
                            .build());
            try {
                List<String> collections = client.listCollectionsAsync().get(5, TimeUnit.SECONDS);
                if (collections.contains(props.getQdrantCollection())) {
                    log.info("Qdrant collection '{}' already exists for PDF assistant", props.getQdrantCollection());
                    return;
                }
                VectorParams params = VectorParams.newBuilder()
                        .setSize(props.getEmbeddingDimension())
                        .setDistance(Distance.Cosine)
                        .build();
                client.createCollectionAsync(props.getQdrantCollection(), params).get(5, TimeUnit.SECONDS);
                log.info("Created Qdrant collection '{}' for PDF assistant", props.getQdrantCollection());
            } finally {
                if (client != null) {
                    client.close();
                }
            }
        } catch (Exception e) {
            log.warn("Could not ensure Qdrant PDF collection '{}': {}", props.getQdrantCollection(), safeMessage(e));
        }
    }

    private void deletePdfVectors(String documentId) {
        Map<String, Object> body = Map.of(
                "filter", Map.of("must", List.of(
                        Map.of("key", "document_id", "match", Map.of("value", documentId))))
        );
        restClientBuilder.build()
                .post()
                .uri("http://{host}:{port}/collections/{collection}/points/delete",
                        props.getQdrantHost(), props.getQdrantRestPort(), props.getQdrantCollection())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    private String generateLlm(String prompt) {
        Exception lastError = null;
        for (int attempt = 1; attempt <= LLM_MAX_RETRIES; attempt++) {
            try {
                return chatModel().generate(prompt);
            } catch (Exception e) {
                lastError = e;
                String msg = e.getMessage() == null ? "" : e.getMessage();
                boolean rateLimited = msg.contains("rate_limit_exceeded") || msg.contains("429");
                if (!rateLimited || attempt == LLM_MAX_RETRIES) {
                    throw new RuntimeException("LLM call failed: " + safeMessage(e), e);
                }
                try {
                    Thread.sleep((long) Math.pow(2, attempt) * 1000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting to retry LLM call", ie);
                }
            }
        }
        throw new RuntimeException("LLM call failed after retries", lastError);
    }

    private ChatLanguageModel chatModel() {
        ChatLanguageModel local = chatModel;
        if (local == null) {
            synchronized (this) {
                local = chatModel;
                if (local == null) {
                    local = OpenAiChatModel.builder()
                            .baseUrl(props.getLlmBaseUrl())
                            .apiKey(props.getLlmApiKey())
                            .modelName(props.getLlmModel())
                            .maxTokens(2048)
                            .timeout(Duration.ofSeconds(120))
                            .maxRetries(2)
                            .build();
                    chatModel = local;
                }
            }
        }
        return local;
    }

    private static String safeMessage(Throwable t) {
        return t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
    }
}
