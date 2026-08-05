package com.careeros.placement.dto;

import java.util.List;

public record CodingProblem(
        String title,
        String statement,
        List<Example> examples,
        String constraints,
        String difficulty,
        List<String> topics
) {
    public record Example(String input, String output) {}
}
