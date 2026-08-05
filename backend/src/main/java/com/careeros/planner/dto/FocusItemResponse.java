package com.careeros.planner.dto;

import java.time.LocalDate;

public record FocusItemResponse(
        String id,
        String title,
        String category,
        String priority,
        String color,
        LocalDate date,
        long daysRemaining,
        double estimatedHours,
        double recommendedHours,
        String reason
) {
}
