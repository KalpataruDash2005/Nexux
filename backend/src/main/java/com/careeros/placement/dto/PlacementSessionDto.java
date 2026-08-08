package com.careeros.placement.dto;

public record PlacementSessionDto(
        String id,
        String type,
        String mode,
        String role,
        String company,
        String difficulty,
        String topic,
        String status,
        Integer score,
        int messageCount,
        String createdAt,
        String startedAt,
        String endedAt,
        String summary
) {}
