package com.careeros.tasks.dto;

import java.util.List;
import java.util.Map;

public record AssistantContextResponse(
        String now,
        String timezone,
        TaskDto activeTask,
        List<TaskDto> recentTasks,
        List<TaskDto> upcomingDeadlines,
        Map<String, String> memory,
        String conversationSummary
) {
}
