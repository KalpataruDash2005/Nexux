package com.careeros.planner.dto;

import java.time.LocalDate;
import java.util.List;

public record StudyPlanResponse(
        LocalDate generatedAt,
        String message,
        List<StudyDayResponse> days
) {
}
