package com.careeros.service;

import com.careeros.entity.Document;
import com.careeros.entity.Summary;
import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.DocumentRepository;
import com.careeros.repository.SummaryRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SummaryService {

    private final SummaryRepository summaryRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final ChatLanguageModel chatLanguageModel;
    private final TextExtractionService textExtractionService;

    @Value("${careeros.ocr.summary-max-pages:30}")
    private int summaryMaxOcrPages;

    private static final int MAX_RETRIES = 5;

    public String getOrGenerateSummary(String ownerEmail, String documentId, String type) {
        // Check cache first
        Optional<Summary> existing = summaryRepository.findByDocumentIdAndType(documentId, type);
        if (existing.isPresent()) {
            return existing.get().getContent();
        }

        // Generate new summary
        Document dbDoc = documentRepository.findById(documentId)
                .orElseThrow(() -> new BadRequestException("Document not found"));

        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        workspaceRepository.findByIdAndOwnerId(dbDoc.getWorkspace().getId(), owner.getId())
                .orElseThrow(() -> new BadRequestException("Document not found or access denied"));

        try {
            Path path = Paths.get(dbDoc.getFilePath());
            dev.langchain4j.data.document.Document langchainDoc =
                    textExtractionService.extractDocument(path, dbDoc.getName(), summaryMaxOcrPages);

            // Truncate to fit within 8k token limit (approx 20,000 characters)
            String text = langchainDoc.text();
            if (text.length() > 20000) {
                text = text.substring(0, 20000) + "...\n[Content Truncated due to length]";
            }

            String lengthInstruction = "Keep it brief (1 paragraph).";
            if ("MEDIUM".equalsIgnoreCase(type)) {
                lengthInstruction = "Provide a comprehensive summary (3-4 paragraphs) with key bullet points.";
            } else if ("DETAILED".equalsIgnoreCase(type)) {
                lengthInstruction = "Provide an exhaustive, highly detailed summary breaking down every major section and concept.";
            } else if ("CHAPTERS".equalsIgnoreCase(type)) {
                lengthInstruction = "The text below is OCR output from a scanned document (possibly handwritten and noisy). " +
                        "Extract the main topics and concepts actually discussed, and present them as a CLEAN study guide. " +
                        "Ignore OCR gibberish and unreadable fragments. " +
                        "Respond strictly as a JSON array of objects, each with \"chapter\" (a concise topic/section label) and \"topics\" (array of short, specific topic names, definitions, or key concepts found in the text). " +
                        "Only include topics you can clearly infer from the text; do not invent names or structure. " +
                        "Do not include markdown block formatting (like `json) or any other text.";
            }

            String prompt = "You are an academic summarizer. Summarize the following document text.\n" +
                    lengthInstruction + "\n\nDocument Text:\n" + text;

            String summaryContent = generateWithRetry(prompt);

            Summary summary = Summary.builder()
                    .document(dbDoc)
                    .type(type.toUpperCase())
                    .content(summaryContent)
                    .build();

            summaryRepository.save(summary);
            return summaryContent;

        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to generate summary", e);
            throw new BadRequestException("Failed to generate summary");
        }
    }

    /**
     * Generates an LLM response, retrying on transient failures such as Groq's
     * rate limits (tokens per minute) with exponential backoff.
     */
    private String generateWithRetry(String prompt) {
        Exception lastError = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return chatLanguageModel.generate(prompt);
            } catch (Exception e) {
                lastError = e;
                String msg = e.getMessage() == null ? "" : e.getMessage();
                boolean rateLimited = msg.contains("rate_limit_exceeded")
                        || msg.contains("rate limit")
                        || msg.contains("429");
                if (!rateLimited || attempt == MAX_RETRIES) {
                    throw e;
                }
                long backoffMs = (long) Math.pow(2, attempt) * 1000;
                log.warn("LLM rate limited (attempt {}/{}), retrying in {} ms", attempt, MAX_RETRIES, backoffMs);
                try {
                    Thread.sleep(backoffMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting to retry LLM call", ie);
                }
            }
        }
        throw new RuntimeException("LLM call failed after retries", lastError);
    }
}
