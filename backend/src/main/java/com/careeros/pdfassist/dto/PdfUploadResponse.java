package com.careeros.pdfassist.dto;

public record PdfUploadResponse(String id, String fileName, PdfDocumentStatus status, String message) {
    public enum PdfDocumentStatus {
        PENDING, PROCESSING, READY, FAILED
    }
}
