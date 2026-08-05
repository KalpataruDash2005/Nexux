package com.careeros.placement.dto;

import java.util.List;

public record CodingEvaluation(
        int correctness,
        String timeComplexity,
        String spaceComplexity,
        int codeQuality,
        int naming,
        int optimization,
        String feedback,
        List<String> alternativeSolutions,
        List<String> expectedQuestions
) {}
