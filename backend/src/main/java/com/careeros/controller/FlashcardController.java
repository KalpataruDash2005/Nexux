package com.careeros.controller;

import com.careeros.entity.Flashcard;
import com.careeros.service.FlashcardService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/flashcards")
@RequiredArgsConstructor
public class FlashcardController {

    private final FlashcardService flashcardService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    @PostMapping("/generate")
    public ResponseEntity<List<Flashcard>> generateFlashcards(
            @PathVariable String workspaceId,
            @RequestBody GenerateRequest request) {

        return ResponseEntity.ok(flashcardService.generateFlashcards(getCurrentUserEmail(), workspaceId, request.getTopic(), request.getCount()));
    }

    @GetMapping
    public ResponseEntity<List<Flashcard>> getFlashcards(@PathVariable String workspaceId) {
        return ResponseEntity.ok(flashcardService.getFlashcards(getCurrentUserEmail(), workspaceId));
    }

    @DeleteMapping("/{flashcardId}")
    public ResponseEntity<Void> deleteFlashcard(
            @PathVariable String workspaceId,
            @PathVariable String flashcardId) {

        flashcardService.deleteFlashcard(getCurrentUserEmail(), workspaceId, flashcardId);
        return ResponseEntity.ok().build();
    }

    @Data
    static class GenerateRequest {
        private String topic;
        private int count = 10;
    }
}
