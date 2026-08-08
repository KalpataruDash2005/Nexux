package com.careeros.controller;

import com.careeros.dto.FeedbackRequestDto;
import com.careeros.entity.FeedbackSubmission;
import com.careeros.repository.FeedbackSubmissionRepository;
import com.careeros.service.notification.EmailNotificationSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/feedback")
@RequiredArgsConstructor
@Slf4j
public class FeedbackController {

    private final EmailNotificationSender emailNotificationSender;
    private final FeedbackSubmissionRepository feedbackSubmissionRepository;

    @Value("${app.feedback.recipient:nexuxstudio19@gmail.com}")
    private String recipient;

    @PostMapping
    public ResponseEntity<Map<String, String>> submit(@RequestBody FeedbackRequestDto request) {
        String name = request.getName() == null ? "" : request.getName().trim();
        String email = request.getEmail() == null ? "" : request.getEmail().trim();
        String message = request.getMessage() == null ? "" : request.getMessage().trim();

        if (email.isEmpty() || message.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and message are required."));
        }

        FeedbackSubmission submission = FeedbackSubmission.builder()
                .name(name)
                .email(email)
                .message(message)
                .status("NEW")
                .build();
        feedbackSubmissionRepository.save(submission);

        String subject = "Nexora Feedback from " + name + " (" + email + ")";
        String body = "Name: " + name
                + "\nEmail: " + email
                + "\n\nMessage:\n" + message;

        try {
            emailNotificationSender.sendNotification(recipient, subject, body);
        } catch (Exception e) {
            log.warn("Feedback persisted but email notification failed: {}", e.getMessage());
        }
        return ResponseEntity.ok(Map.of("status", "sent"));
    }
}
