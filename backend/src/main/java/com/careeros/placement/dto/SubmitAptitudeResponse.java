package com.careeros.placement.dto;

import java.util.List;

public record SubmitAptitudeResponse(
        int score,
        int total,
        int percentage,
        boolean sessionCompleted,
        List<AptitudeResultItem> detailed
) {}
