package com.careeros.planner.dto;

import java.time.LocalDate;
import java.util.List;

public record StudyDayResponse(
        LocalDate date,
        String label,
        double totalHours,
        List<StudySlotResponse> items
) {
}
