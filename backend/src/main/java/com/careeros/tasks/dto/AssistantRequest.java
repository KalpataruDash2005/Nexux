package com.careeros.tasks.dto;

public record AssistantRequest(
        String taskId,
        String message,
        String pageContext,
        String timezone
) {
}