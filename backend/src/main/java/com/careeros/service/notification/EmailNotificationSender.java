package com.careeros.service.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailNotificationSender implements NotificationService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:noreply@careeros.com}")
    private String fromEmail;

    @Override
    public void sendNotification(String to, String subject, String message) {
        String finalFromEmail = (fromEmail == null || fromEmail.trim().isEmpty()) ? "noreply@careeros.com" : fromEmail;
        log.info("Sending email to {} with subject: {}", to, subject);
        try {
            SimpleMailMessage mailMessage = new SimpleMailMessage();
            mailMessage.setFrom(finalFromEmail);
            mailMessage.setTo(to);
            mailMessage.setSubject(subject);
            mailMessage.setText(message);
            
            mailSender.send(mailMessage);
            log.info("Email sent successfully to {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to {}", to, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }
}
