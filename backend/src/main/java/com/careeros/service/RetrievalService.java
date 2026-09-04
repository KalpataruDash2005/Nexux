package com.careeros.service;

import com.careeros.entity.ChatMessage;
import com.careeros.entity.ChatSession;
import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.ChatMessageRepository;
import com.careeros.repository.ChatSessionRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import com.careeros.service.rag.RagServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RetrievalService {

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final RagServiceClient ragServiceClient;

    public String askQuestion(String workspaceId, String sessionId, String question, String ownerEmail) {
        ChatSession session = resolveSession(workspaceId, sessionId, ownerEmail);

        // Save User Message
        chatMessageRepository.save(ChatMessage.builder()
                .session(session)
                .role(ChatMessage.Role.USER)
                .content(question)
                .build());

        String answer;
        try {
            // Forward to RAG service
            // topK of 5 is a reasonable default for standard chat
            RagServiceClient.AskResponse response = ragServiceClient.askQuestion(workspaceId, null, question, 5);
            answer = response.getAnswer();
        } catch (Exception e) {
            log.error("Failed to ask question via RAG service", e);
            answer = "Sorry, I encountered an error while trying to answer your question: " + e.getMessage();
        }

        // Save AI Message
        chatMessageRepository.save(ChatMessage.builder()
                .session(session)
                .role(ChatMessage.Role.AI)
                .content(answer)
                .build());

        return answer;
    }

    public List<ChatMessage> getMessages(String workspaceId, String sessionId, String ownerEmail) {
        ChatSession session = resolveSession(workspaceId, sessionId, ownerEmail);
        return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
    }

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
