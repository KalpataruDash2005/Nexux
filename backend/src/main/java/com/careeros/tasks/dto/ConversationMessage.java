package com.careeros.tasks.dto;

public record ConversationMessage(
        String id,
        String role,
        String content,
        String createdAt
) {
}
