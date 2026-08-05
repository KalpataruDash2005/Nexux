package com.careeros.tasks.dto;

public record CreateTaskRequest(
        String title,
        String deadline
) {
}
