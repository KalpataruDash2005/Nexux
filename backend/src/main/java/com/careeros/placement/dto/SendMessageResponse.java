package com.careeros.placement.dto;

public record SendMessageResponse(
        InterviewFeedback feedback,
        boolean sessionCompleted,
        String finalSummary
) {}
