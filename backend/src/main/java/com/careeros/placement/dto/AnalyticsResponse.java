package com.careeros.placement.dto;

import java.util.List;

public record AnalyticsResponse(
        int technical,
        int hr,
        int communication,
        int coding,
        int dsa,
        int aptitude,
        int resume,
        int overallReadiness,
        List<DateScore> daily,
        List<DateScore> weekly,
        List<DateScore> monthly,
        int timeSpentMinutes,
        int accuracy,
        int successRate,
        List<String> strongTopics,
        List<String> weakTopics
) {
    public record DateScore(String date, int score) {}
}
