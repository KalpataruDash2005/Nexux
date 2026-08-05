package com.careeros.placement.dto;

public record LatestResumeResponse(
        String resumeId,
        String fileName,
        int textLength,
        AnalyzeResumeResponse.Analysis analysis
) {}
