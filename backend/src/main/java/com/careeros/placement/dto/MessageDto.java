package com.careeros.placement.dto;

public record MessageDto(
        String id,
        String role,
        String content,
        InterviewFeedback analysis,
        String createdAt
) {}
