package com.careeros.planner.dto;

import java.time.LocalDate;
import java.util.List;

public record TodayFocusResponse(
        LocalDate date,
        List<FocusItemResponse> focus,
        List<String> recommendations
) {
}
