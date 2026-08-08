package com.careeros.dto;

import lombok.Data;

@Data
public class FeedbackRequestDto {
    private String name;
    private String email;
    private String message;
}
