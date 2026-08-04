package com.careeros.pdfassist.dto;

import com.careeros.pdfassist.entity.PdfDocument;

import java.util.Map;

/**
 * Payload accepted by the internal callback endpoint. It is posted by the n8n
 * workflow after it has stored chunks in Qdrant and generated a summary.
 */
public record PdfResultRequest(
        String documentId,
        PdfDocument.Status status,
        String summary,
        Integer chunkCount,
        String error,
        String source,
        Map<String, Object> metadata
) {
}
