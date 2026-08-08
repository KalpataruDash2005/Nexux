package com.careeros.placement.dto;

public record CodingTestResult(
        boolean passed,
        String input,
        String expectedOutput,
        String actualOutput,
        String error,
        boolean hidden
) {}