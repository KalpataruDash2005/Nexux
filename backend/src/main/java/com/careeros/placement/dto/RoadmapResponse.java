package com.careeros.placement.dto;

import java.util.List;

public record RoadmapResponse(
        List<String> weakTopics,
        List<String> dailyTasks,
        List<String> weeklyGoals,
        List<String> interviewSchedule,
        List<CompanyPrep> companyPreparation,
        List<String> resumeImprovements,
        List<String> codingRecommendations,
        List<String> dsaRevision,
        List<String> aptitudePractice
) {
    public record CompanyPrep(String company, String notes) {}

    public record RoadmapAi(
            List<String> weakTopics,
            List<String> dailyTasks,
            List<String> weeklyGoals,
            List<String> interviewSchedule,
            List<CompanyPrep> companyPreparation,
            List<String> resumeImprovements,
            List<String> codingRecommendations,
            List<String> dsaRevision,
            List<String> aptitudePractice
    ) {}
}
