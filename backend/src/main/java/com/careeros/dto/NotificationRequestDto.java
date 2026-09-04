package com.careeros.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class NotificationRequestDto {
    @NotBlank(message = "Recipient email is required")
    private String to;
    @NotBlank(message = "Event type is required")
    private String eventType;
    @NotBlank(message = "Recipient name is required")
    private String recipientName;
    private String additionalData;
}
