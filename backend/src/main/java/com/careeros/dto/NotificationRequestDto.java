package com.careeros.dto;

import lombok.Data;

@Data
public class NotificationRequestDto {
    private String to;
    private String eventType;
    private String recipientName;
    private String additionalData;
}
