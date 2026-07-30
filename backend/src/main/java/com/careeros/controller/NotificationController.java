package com.careeros.controller;

import com.careeros.dto.NotificationRequestDto;
import com.careeros.service.notification.AiNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final AiNotificationService aiNotificationService;

    @PostMapping
    public ResponseEntity<String> sendNotification(@RequestBody NotificationRequestDto requestDto) {
        aiNotificationService.processAndSendNotification(requestDto);
        return ResponseEntity.ok("Notification request processed successfully");
    }
}
