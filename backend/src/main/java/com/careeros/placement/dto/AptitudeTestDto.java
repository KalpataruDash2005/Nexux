package com.careeros.placement.dto;

import java.util.List;

public record AptitudeTestDto(List<Question> questions) {

    public record Question(
            String id,
            String text,
            List<String> options,
            Integer correctAnswerIndex,
            String explanation,
            String shortcut,
            String difficulty,
            String companyFrequency
    ) {}

    public AptitudeTestDto forClient() {
        if (questions == null) {
            return new AptitudeTestDto(List.of());
        }
        List<Question> sanitized = questions.stream()
                .map(q -> new Question(q.id(), q.text(), q.options(), null, null, null, q.difficulty(), q.companyFrequency()))
                .toList();
        return new AptitudeTestDto(sanitized);
    }
}
