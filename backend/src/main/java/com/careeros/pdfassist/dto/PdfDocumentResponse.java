package com.careeros.pdfassist.dto;

import com.careeros.pdfassist.entity.PdfDocument;

import java.time.LocalDateTime;

public record PdfDocumentResponse(
        String id,
        String fileName,
        long fileSize,
        String contentType,
        PdfDocument.Status status,
        PdfDocument.Source processingSource,
        String summary,
        Integer chunkCount,
        String errorMessage,
        LocalDateTime processedAt,
        LocalDateTime createdAt
) {
    public static PdfDocumentResponse from(PdfDocument doc) {
        return new PdfDocumentResponse(
                doc.getId(),
                doc.getFileName(),
                doc.getFileSize(),
                doc.getContentType(),
                doc.getStatus(),
                doc.getProcessingSource(),
                doc.getSummary(),
                doc.getChunkCount(),
                doc.getErrorMessage(),
                doc.getProcessedAt(),
                doc.getCreatedAt()
        );
    }
}