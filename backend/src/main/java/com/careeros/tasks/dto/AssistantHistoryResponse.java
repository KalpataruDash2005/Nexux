package com.careeros.tasks.dto;

import java.util.List;

/** Wrapper for the assistant conversation-history endpoint. */
public record AssistantHistoryResponse(
        List<ConversationMessage> messages
) {
}