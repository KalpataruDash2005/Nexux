package com.careeros.dto.admin;

import java.time.LocalDateTime;

public record AptitudeSetDto(
        String id,
        String title,
        String fileName,
        int questionCount,
        String createdBy,
        LocalDateTime createdAt
) {}