package com.careeros.planner.dto;

import com.careeros.planner.entity.AcademicEvent;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;

public record PlannerEventResponse(
        String id,
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
        boolean completed,
        boolean needsVerification,
        Double aiConfidence,
        Long daysRemaining,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static PlannerEventResponse from(AcademicEvent e) {
        Long days = e.getEventDate() == null ? null
                : ChronoUnit.DAYS.between(LocalDate.now(), e.getEventDate());
        return new PlannerEventResponse(
                e.getId(),
                e.getTitle(),
                e.getDescription(),
                e.getEventDate(),
                e.getStartTime(),
                e.getEndTime(),
                e.getCategory(),
                e.getPriority(),
                e.getColor(),
                e.getLocation(),
                e.getSemester(),
                e.isCompleted(),
                e.isNeedsVerification(),
                e.getAiConfidence(),
                days,
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
