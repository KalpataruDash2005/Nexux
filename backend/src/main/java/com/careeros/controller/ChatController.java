package com.careeros.controller;

import com.careeros.entity.ChatMessage;
import com.careeros.service.RetrievalService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/chat")
@RequiredArgsConstructor
public class ChatController {

    private final RetrievalService retrievalService;

    @PostMapping
    public ResponseEntity<ChatResponse> askQuestion(
            @PathVariable String workspaceId,
            @RequestParam(value = "sessionId", required = false) String sessionId,
            @RequestBody ChatRequest request,
            Authentication authentication) {

        String answer = retrievalService.askQuestion(workspaceId, sessionId, request.getQuestion(), authentication.getName());
        return ResponseEntity.ok(new ChatResponse(answer));
    }

    @GetMapping
    public ResponseEntity<List<ChatMessage>> getMessages(
            @PathVariable String workspaceId,
            @RequestParam(value = "sessionId", required = false) String sessionId,
            Authentication authentication) {

        return ResponseEntity.ok(retrievalService.getMessages(workspaceId, sessionId, authentication.getName()));
    }

    @Data
    static class ChatRequest {
        private String question;
    }

    @Data
    static class ChatResponse {
        private final String answer;
        public ChatResponse(String answer) {
            this.answer = answer;
        }
    }
}
