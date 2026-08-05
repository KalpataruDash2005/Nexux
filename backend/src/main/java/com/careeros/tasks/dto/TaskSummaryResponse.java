package com.careeros.tasks.dto;

public record TaskSummaryResponse(
        long total,
        long completed,
        long pending,
        long overdue
) {
}
