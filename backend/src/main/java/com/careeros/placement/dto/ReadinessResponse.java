package com.careeros.placement.dto;

import java.util.List;

public record ReadinessResponse(
        int score,
        String label,
        List<ComponentScore> components,
        List<String> recommendedCompanies,
        List<String> recommendedRoles,
        List<LearningItem> learningPath
) {
    public record ComponentScore(String name, int score, int weight) {}

    public record LearningItem(String topic, List<String> resources, int estimatedHours, String priority) {}

    public record ReadinessAi(
            List<String> recommendedCompanies,
            List<String> recommendedRoles,
            List<LearningItem> learningPath
    ) {}
}
