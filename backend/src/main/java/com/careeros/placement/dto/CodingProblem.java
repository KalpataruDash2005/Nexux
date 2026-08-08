package com.careeros.placement.dto;

import java.util.List;

public record CodingProblem(
        String title,
        String statement,
        List<Example> examples,
        String constraints,
        String difficulty,
        List<String> topics,
        List<CodingTest> testCases
) {
    public record Example(String input, String output) {}
    public record CodingTest(String input, String expectedOutput, boolean hidden) {}
}
