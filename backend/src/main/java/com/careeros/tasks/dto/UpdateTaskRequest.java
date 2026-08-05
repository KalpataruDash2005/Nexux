package com.careeros.tasks.dto;

public record UpdateTaskRequest(
        String title,
        String status,
        String deadline
) {
}
