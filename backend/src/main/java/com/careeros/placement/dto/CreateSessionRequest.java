package com.careeros.placement.dto;

public record CreateSessionRequest(
        String type,
        String mode,
        String role,
        String company,
        String difficulty,
        String resumeId
) {}
