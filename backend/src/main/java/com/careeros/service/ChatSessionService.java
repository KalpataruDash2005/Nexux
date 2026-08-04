package com.careeros.service;

import com.careeros.dto.chat.ChatSessionResponseDto;
import com.careeros.entity.ChatSession;
import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.ChatSessionRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatSessionService {

    private final ChatSessionRepository chatSessionRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;

    public ChatSessionResponseDto createSession(String ownerEmail, String workspaceId, String title) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        ChatSession session = ChatSession.builder()
                .workspace(workspace)
                .owner(owner)
                .title(title == null || title.isEmpty() ? "New Chat" : title)
                .build();

        session = chatSessionRepository.save(session);
        return mapToDto(session);
    }

    public List<ChatSessionResponseDto> getSessions(String ownerEmail, String workspaceId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        return chatSessionRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public void deleteSession(String ownerEmail, String workspaceId, String sessionId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        ChatSession session = chatSessionRepository.findByIdAndWorkspaceId(sessionId, workspaceId)
                .orElseThrow(() -> new BadRequestException("Chat session not found"));

        chatSessionRepository.delete(session);
    }

    private ChatSessionResponseDto mapToDto(ChatSession session) {
        return ChatSessionResponseDto.builder()
                .id(session.getId())
                .workspaceId(session.getWorkspace().getId())
                .title(session.getTitle())
                .createdAt(session.getCreatedAt())
                .build();
    }
}
