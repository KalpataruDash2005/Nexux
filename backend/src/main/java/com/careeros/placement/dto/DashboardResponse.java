package com.careeros.placement.dto;

import java.util.List;

public record DashboardResponse(
        int readiness,
        String readinessLabel,
        int streak,
        int questionsAnswered,
        int interviewsCompleted,
        int codingProblems,
        int resumeScore,
        TodayPractice todayPractice,
        List<String> weakAreas,
        List<String> strongAreas,
        List<DayScore> weeklyProgress,
        List<RecentFeedback> recentFeedback
) {
    public record TodayPractice(int sessionsToday, int questionsToday, int goal) {}

    public record DayScore(String day, int score) {}

    public record RecentFeedback(String sessionTitle, String type, String date, String summary) {}
}
