package com.careeros.placement.dto;

public record SubmitCodingResponse(CodingEvaluation evaluation, boolean passed, int totalScore) {}
