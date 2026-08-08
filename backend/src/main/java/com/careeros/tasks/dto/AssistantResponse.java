package com.careeros.tasks.dto;

import java.util.List;

public record AssistantResponse(
        String replyMessage,
        String action,
        TaskDto updatedTask,
        List<AssistantChunkDto> newChunks
) {
}