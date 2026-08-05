package com.careeros.planner.dto;

public record SubjectProgress(
        String subject,
        double plannedHours,
        double completedHours,
        int percent
) {
}
