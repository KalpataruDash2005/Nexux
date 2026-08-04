package com.careeros.pdfassist.dto;

import java.util.List;

public record PdfChatResponse(
        String answer,
        List<String> sources,
        List<PdfChatMessageResponse> history
) {
}
