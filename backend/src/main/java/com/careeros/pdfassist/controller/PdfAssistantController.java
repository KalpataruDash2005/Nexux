package com.careeros.pdfassist.controller;

import com.careeros.pdfassist.dto.PdfChatMessageResponse;
import com.careeros.pdfassist.dto.PdfChatRequest;
import com.careeros.pdfassist.dto.PdfChatResponse;
import com.careeros.pdfassist.dto.PdfDocumentResponse;
import com.careeros.pdfassist.dto.PdfUploadResponse;
import com.careeros.pdfassist.service.PdfAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/pdf-assistant/workspaces/{workspaceId}/documents")
@RequiredArgsConstructor
public class PdfAssistantController {

    private final PdfAssistantService pdfAssistantService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    @PostMapping
    public ResponseEntity<PdfUploadResponse> upload(@PathVariable String workspaceId,
                                                    @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(pdfAssistantService.upload(workspaceId, getCurrentUserEmail(), file));
    }

    @GetMapping
    public ResponseEntity<List<PdfDocumentResponse>> list(@PathVariable String workspaceId) {
        return ResponseEntity.ok(pdfAssistantService.listDocuments(workspaceId, getCurrentUserEmail()));
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<PdfDocumentResponse> get(@PathVariable String workspaceId,
                                                   @PathVariable String documentId) {
        return ResponseEntity.ok(pdfAssistantService.getDocument(workspaceId, documentId, getCurrentUserEmail()));
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> delete(@PathVariable String workspaceId,
                                       @PathVariable String documentId) {
        pdfAssistantService.delete(workspaceId, documentId, getCurrentUserEmail());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{documentId}/chat")
    public ResponseEntity<PdfChatResponse> chat(@PathVariable String workspaceId,
                                                @PathVariable String documentId,
                                                @RequestBody PdfChatRequest request) {
        return ResponseEntity.ok(pdfAssistantService.chat(workspaceId, documentId, getCurrentUserEmail(), request));
    }

    @GetMapping("/{documentId}/chat")
    public ResponseEntity<List<PdfChatMessageResponse>> history(@PathVariable String workspaceId,
                                                                @PathVariable String documentId) {
        return ResponseEntity.ok(pdfAssistantService.history(workspaceId, documentId, getCurrentUserEmail()));
    }
}
