package com.careeros.controller;

import com.careeros.entity.Quiz;
import com.careeros.service.QuizService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/quizzes")
@RequiredArgsConstructor
public class QuizController {

    private final QuizService quizService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    @PostMapping("/generate")
    public ResponseEntity<Quiz> generateQuiz(
            @PathVariable String workspaceId,
            @RequestBody GenerateQuizRequest request) {

        return ResponseEntity.ok(quizService.generateQuiz(getCurrentUserEmail(), workspaceId, request.getTopic(), request.getDifficulty(), request.getCount()));
    }

    @GetMapping
    public ResponseEntity<List<Quiz>> getQuizzes(@PathVariable String workspaceId) {
        return ResponseEntity.ok(quizService.getQuizzes(getCurrentUserEmail(), workspaceId));
    }

    @Data
    static class GenerateQuizRequest {
        private String topic;
        private String difficulty = "MEDIUM";
        private int count = 5;
    }
}
