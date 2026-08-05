package com.careeros.planner.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record UpdateEventRequest(
        String title,
        String description,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        String category,
        String priority,
        String color,
        String location,
        String semester,
        Boolean completed,
        Boolean needsVerification
) {
}
