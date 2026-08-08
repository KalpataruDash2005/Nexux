package com.careeros.placement.dto;

import java.util.List;

public record SubmitCodingResponse(
        CodingEvaluation evaluation,
        boolean passed,
        int totalScore,
        List<CodingTestResult> testResults,
        int passedTests,
        int totalTests
) {}