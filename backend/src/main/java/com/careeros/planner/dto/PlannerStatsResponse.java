package com.careeros.planner.dto;

import java.util.List;
import java.util.Map;

public record PlannerStatsResponse(
        long totalEvents,
        long upcomingEvents,
        long completedEvents,
        long needsVerification,
        Map<String, Long> byCategory,
        List<SubjectProgress> studyProgress
) {
}
