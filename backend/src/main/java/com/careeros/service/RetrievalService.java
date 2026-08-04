package com.careeros.service;

import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.filter.Filter;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import com.careeros.entity.ChatMessage;
import com.careeros.entity.ChatSession;
import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.ChatMessageRepository;
import com.careeros.repository.ChatSessionRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RetrievalService {

    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;
    private final ChatLanguageModel chatLanguageModel;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;

    private static final int MAX_RETRIES = 5;

    public String askQuestion(String workspaceId, String sessionId, String question, String ownerEmail) {
        ChatSession session = resolveSession(workspaceId, sessionId, ownerEmail);

        // Save User Message
        chatMessageRepository.save(ChatMessage.builder()
                .session(session)
                .role(ChatMessage.Role.USER)
                .content(question)
                .build());

        // 1. Embed the question
        dev.langchain4j.data.embedding.Embedding questionEmbedding = embeddingModel.embed(question).content();

        // 2. Search Qdrant for relevant chunks in the specific workspace
        Filter workspaceFilter = MetadataFilterBuilder.metadataKey("workspace_id").isEqualTo(workspaceId);

        EmbeddingSearchRequest request = EmbeddingSearchRequest.builder()
                .queryEmbedding(questionEmbedding)
                .maxResults(3)
                .minScore(0.5)
                .filter(workspaceFilter)
                .build();

        EmbeddingSearchResult<TextSegment> searchResult = embeddingStore.search(request);

        // 3. Build the prompt
        if (searchResult.matches().isEmpty()) {
            return "I couldn't find this information in your uploaded documents.";
        }

        String context = searchResult.matches().stream()
                .map(match -> {
                    String docName = match.embedded().metadata().getString("document_name");
                    return "Source: [DOCUMENT_NAME: " + docName + "]\n" + match.embedded().text();
                })
                .collect(Collectors.joining("\n\n"));

        // Keep the prompt small enough to stay within Groq's free-tier TPM limit
        if (context.length() > 8000) {
            context = context.substring(0, 8000) + "...";
        }

        String prompt = """
                You are a warm, patient study buddy and academic tutor.

                Answer the student's question in a clear, well-organized way that helps them truly understand the topic.

                Guidelines:
                - Base your answer ONLY on the context below, which comes from their uploaded documents. Never invent facts.
                - Explain step by step, define any jargon in plain language, and use a concrete example or short analogy when it helps.
                - Structure the answer with short paragraphs or a few bullet points so it's easy to read.
                - Answer the actual question first, then elaborate and connect the ideas.
                - Always mention which document(s) the answer came from.
                - If the context does not contain the answer, say so honestly and suggest what they could upload or ask next.
                - Keep a natural, friendly, human tone — like a helpful senior explaining it. No corporate or robotic phrasing.

                Context:
                %s

                Question: %s
                """.formatted(context, question);

        // 4. Get answer from Groq
        String answer = generateWithRetry(prompt);

        // Save AI Message
        chatMessageRepository.save(ChatMessage.builder()
                .session(session)
                .role(ChatMessage.Role.AI)
                .content(answer)
                .build());

        return answer;
    }

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

    public List<ChatMessage> getMessages(String workspaceId, String sessionId, String ownerEmail) {
        ChatSession session = resolveSession(workspaceId, sessionId, ownerEmail);
        return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
    }

    /**
     * Resolves a chat session for the given workspace, validating that the
     * authenticated user owns both the workspace and the session.
     *
     * <p>If no sessionId is supplied, the most recent session for the workspace is
     * reused, or a new one is created automatically. This avoids the previous
     * hardcoded "default" sessionId that never existed in the database.
     */
    private ChatSession resolveSession(String workspaceId, String sessionId, String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        if (sessionId != null && !sessionId.isBlank()) {
            return chatSessionRepository.findByIdAndWorkspaceId(sessionId, workspaceId)
                    .filter(s -> s.getOwner() != null && s.getOwner().getId().equals(owner.getId()))
                    .orElseThrow(() -> new BadRequestException("Chat session not found"));
        }

        return chatSessionRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId)
                .stream()
                .filter(s -> s.getOwner() != null && s.getOwner().getId().equals(owner.getId()))
                .findFirst()
                .orElseGet(() -> chatSessionRepository.save(ChatSession.builder()
                        .workspace(workspace)
                        .owner(owner)
                        .title("New Conversation")
                        .build()));
    }
}
