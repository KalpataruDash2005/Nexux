package com.careeros.tasks.dto;

public record TaskDto(
        String id,
        String title,
        String status,
        String progressNotes,
        String parentTaskId,
        String deadline,
        String createdAt,
        String estimatedHours,
        String remainingHours,
        Integer chunkIndex,
        Integer totalChunks,
        boolean aiGenerated,
        String startedAt,
        String pausedAt,
        String completedAt,
        String lastActivity
) {
}
