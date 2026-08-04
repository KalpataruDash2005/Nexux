package com.careeros.pdfassist.controller;

import com.careeros.pdfassist.config.PdfAssistantProperties;
import com.careeros.pdfassist.dto.PdfDocumentResponse;
import com.careeros.pdfassist.dto.PdfResultRequest;
import com.careeros.pdfassist.service.PdfAssistantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal endpoint called by the n8n workflow after processing completes.
 * Protected by a shared secret header (never reached by the browser).
 */
@RestController
@RequestMapping("/api/v1/pdf-assistant/internal")
@RequiredArgsConstructor
@Slf4j
public class PdfAssistantInternalController {

    private final PdfAssistantService pdfAssistantService;
    private final PdfAssistantProperties props;

    @PostMapping("/result")
    public ResponseEntity<PdfDocumentResponse> result(@RequestHeader(value = "X-Internal-Key", required = false) String internalKey,
                                                      @RequestBody PdfResultRequest request) {
        if (internalKey == null || !internalKey.equals(props.getInternalKey())) {
            return ResponseEntity.status(403).build();
        }
        PdfDocumentResponse response = pdfAssistantService.applyInternalResult(request);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }
}
