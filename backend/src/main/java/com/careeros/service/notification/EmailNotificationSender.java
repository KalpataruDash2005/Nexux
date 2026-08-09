package com.careeros.service.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailNotificationSender implements NotificationService {

    private final JavaMailSender mailSender;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${spring.mail.username:noreply@careeros.com}")
    private String fromEmail;

    @Value("${app.resend.api-key:}")
    private String resendApiKey;

    @Value("${app.resend.from:noreply@careeros.com}")
    private String resendFrom;

    @Value("${app.resend.api-url:https://api.resend.com/emails}")
    private String resendApiUrl;

    @Override
    public void sendNotification(String to, String subject, String message) {
        if (resendApiKey != null && !resendApiKey.trim().isEmpty()) {
            sendViaResend(to, subject, message);
        } else {
            sendViaSmtp(to, subject, message);
        }
    }

    private void sendViaSmtp(String to, String subject, String message) {
        String finalFromEmail = (fromEmail == null || fromEmail.trim().isEmpty()) ? "noreply@careeros.com" : fromEmail;
        log.info("Sending email via SMTP to {} with subject: {}", to, subject);
        try {
            SimpleMailMessage mailMessage = new SimpleMailMessage();
            mailMessage.setFrom(finalFromEmail);
            mailMessage.setTo(to);
            mailMessage.setSubject(subject);
            mailMessage.setText(message);

            mailSender.send(mailMessage);
            log.info("Email sent successfully via SMTP to {}", to);
        } catch (Exception e) {
            log.error("Failed to send email via SMTP to {}", to, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    private void sendViaResend(String to, String subject, String message) {
        String finalFrom = (resendFrom == null || resendFrom.trim().isEmpty()) ? "noreply@careeros.com" : resendFrom;
        log.info("Sending email via Resend to {} with subject: {}", to, subject);
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(resendApiKey);

            Map<String, Object> body = new HashMap<>();
            body.put("from", finalFrom);
            body.put("to", List.of(to));
            body.put("subject", subject);
            body.put("text", message);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            String response = restTemplate.postForObject(resendApiUrl, entity, String.class);
            log.info("Email sent successfully via Resend to {}. Response: {}", to, response);
        } catch (Exception e) {
            log.error("Failed to send email via Resend to {}", to, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }
}
