package com.careeros.placement.dto;

import java.util.List;

public record AptitudeParsedQuestion(
        String text,
        List<String> options,
        int correctIndex,
        String explanation,
        String difficulty,
        String topic,
        String category
) {}