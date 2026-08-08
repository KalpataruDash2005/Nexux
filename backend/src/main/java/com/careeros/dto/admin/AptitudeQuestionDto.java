package com.careeros.dto.admin;

import java.time.LocalDateTime;
import java.util.List;

public record AptitudeQuestionDto(
        String id,
        String text,
        List<String> options,
        int correctIndex,
        String explanation,
        String difficulty,
        String topic,
        String category,
        LocalDateTime createdAt
) {}