package com.careeros.tasks.dto;

public record TaskDto(
        String id,
        String title,
        String status,
        String deadline,
        String createdAt
) {
}
