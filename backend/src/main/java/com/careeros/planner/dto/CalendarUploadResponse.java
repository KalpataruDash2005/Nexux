package com.careeros.planner.dto;

import java.time.LocalDate;
import java.util.List;

public record CalendarUploadResponse(
        int importedCount,
        int duplicatesSkipped,
        int needsVerification,
        LocalDate semesterStart,
        LocalDate semesterEnd,
        List<String> warnings,
        List<PlannerEventResponse> events,
        String message
) {
}
