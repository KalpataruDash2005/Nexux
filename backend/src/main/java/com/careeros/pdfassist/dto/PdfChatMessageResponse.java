package com.careeros.pdfassist.dto;

import com.careeros.pdfassist.entity.PdfChatMessage;

import java.time.LocalDateTime;

public record PdfChatMessageResponse(
        String id,
        String role,
        String content,
        LocalDateTime createdAt
) {
    public static PdfChatMessageResponse from(PdfChatMessage message) {
        return new PdfChatMessageResponse(
                message.getId(),
                message.getRole().name(),
                message.getContent(),
                message.getCreatedAt()
        );
    }
}
