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
            String companyFrequency,
            String topic,
            String formulaUsed,
            String commonMistake,
            String timeToSolve,
            Integer marks
    ) {}

    public AptitudeTestDto forClient() {
        if (questions == null) {
            return new AptitudeTestDto(List.of());
        }
        List<Question> sanitized = questions.stream()
                .map(q -> new Question(q.id(), q.text(), q.options(), null, null, null, q.difficulty(), q.companyFrequency(),
                        q.topic(), null, null, q.timeToSolve(), q.marks()))
                .toList();
        return new AptitudeTestDto(sanitized);
    }
}
