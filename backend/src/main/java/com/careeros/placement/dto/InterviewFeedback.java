package com.careeros.placement.dto;

import java.util.List;
import java.util.Map;

public record InterviewFeedback(
        int score,
        Map<String, Integer> scores,
        List<String> strengths,
        List<String> weaknesses,
        List<String> improvementTips,
        String idealAnswer,
        String nextQuestion,
        String nextDifficulty,
        int questionCount,
        boolean shouldEnd,
        String finalSummary
) {}
