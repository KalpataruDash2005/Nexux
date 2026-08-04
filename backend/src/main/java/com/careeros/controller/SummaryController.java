package com.careeros.controller;

import com.careeros.service.SummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/documents/{documentId}/summaries")
@RequiredArgsConstructor
public class SummaryController {

    private final SummaryService summaryService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    @GetMapping
    public ResponseEntity<String> getSummary(
            @PathVariable String documentId,
            @RequestParam(defaultValue = "SHORT") String type) {

        return ResponseEntity.ok(summaryService.getOrGenerateSummary(getCurrentUserEmail(), documentId, type));
    }
}
