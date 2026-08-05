package com.careeros.planner.dto;

import java.time.LocalDate;
import java.util.List;

public record DailyScheduleResponse(
        LocalDate date,
        double totalHours,
        List<StudySlotResponse> items
) {
}
