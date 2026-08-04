package com.careeros.controller;

import com.careeros.dto.document.DocumentResponseDto;
import com.careeros.service.DocumentService;
import com.careeros.service.SummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final SummaryService summaryService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName(); 
    }

    @PostMapping
    public ResponseEntity<DocumentResponseDto> uploadDocument(
            @PathVariable String workspaceId,
            @RequestParam("file") MultipartFile file) {
        
        return ResponseEntity.ok(documentService.uploadDocument(getCurrentUserEmail(), workspaceId, file));
    }

    @GetMapping
    public ResponseEntity<List<DocumentResponseDto>> getDocuments(@PathVariable String workspaceId) {
        return ResponseEntity.ok(documentService.getDocumentsByWorkspace(getCurrentUserEmail(), workspaceId));
    }

    @GetMapping("/{documentId}/chapters")
    public ResponseEntity<String> getDocumentChapters(@PathVariable String documentId) {
        return ResponseEntity.ok(summaryService.getOrGenerateSummary(getCurrentUserEmail(), documentId, "CHAPTERS"));
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable String workspaceId,
            @PathVariable String documentId) {
        
        documentService.deleteDocument(getCurrentUserEmail(), workspaceId, documentId);
        return ResponseEntity.ok().build();
    }
}
