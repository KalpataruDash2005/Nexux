package com.careeros.controller;

import com.careeros.dto.chat.ChatSessionResponseDto;
import com.careeros.dto.chat.CreateChatSessionRequest;
import com.careeros.service.ChatSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/sessions")
@RequiredArgsConstructor
public class ChatSessionController {

    private final ChatSessionService chatSessionService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    @PostMapping
    public ResponseEntity<ChatSessionResponseDto> createSession(
            @PathVariable String workspaceId,
            @RequestBody CreateChatSessionRequest request) {
        return ResponseEntity.ok(chatSessionService.createSession(getCurrentUserEmail(), workspaceId, request.getTitle()));
    }

    @GetMapping
    public ResponseEntity<List<ChatSessionResponseDto>> getSessions(@PathVariable String workspaceId) {
        return ResponseEntity.ok(chatSessionService.getSessions(getCurrentUserEmail(), workspaceId));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable String workspaceId,
            @PathVariable String sessionId) {
        chatSessionService.deleteSession(getCurrentUserEmail(), workspaceId, sessionId);
        return ResponseEntity.ok().build();
    }
}
