package com.careeros.placement.dto;

public record AptitudeResultItem(
        String questionId,
        boolean correct,
        int correctAnswerIndex,
        int yourAnswer,
        String explanation
) {}
