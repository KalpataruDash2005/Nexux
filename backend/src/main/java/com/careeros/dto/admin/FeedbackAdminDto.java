package com.careeros.dto.admin;

import java.time.LocalDateTime;

public record FeedbackAdminDto(
        String id,
        String name,
        String email,
        String message,
        String status,
        LocalDateTime createdAt
) {}