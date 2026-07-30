package com.careeros.service.notification;

import com.careeros.dto.NotificationRequestDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiNotificationService {

    private final NotificationService emailNotificationSender;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openai.api.key:}")
    private String openAiApiKey;

    @Value("${openai.api.url:https://api.openai.com/v1/chat/completions}")
    private String openAiApiUrl;

    public void processAndSendNotification(NotificationRequestDto requestDto) {
        log.info("Processing AI notification for event: {}", requestDto.getEventType());

        if (openAiApiKey == null || openAiApiKey.isEmpty()) {
            log.warn("OpenAI API key not configured. Sending default fallback message.");
            emailNotificationSender.sendNotification(
                    requestDto.getTo(),
                    "CareerOS Notification: " + requestDto.getEventType(),
                    "Hello " + requestDto.getRecipientName() + ",\n\n" +
                    "This is an automated notification regarding: " + requestDto.getEventType() + ".\n" +
                    "Details: " + requestDto.getAdditionalData() + "\n\nBest,\nCareerOS Team"
            );
            return;
        }

        try {
            String prompt = String.format(
                    "You are a helpful assistant for a placement and career management system called CareerOS. " +
                    "Write a professional and encouraging email notification. " +
                    "Recipient Name: %s\nEvent Type: %s\nAdditional Details: %s\n" +
                    "Respond with a JSON object containing exactly two keys: 'subject' (for the email subject) and 'body' (for the email body).",
                    requestDto.getRecipientName(), requestDto.getEventType(), requestDto.getAdditionalData()
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(openAiApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "gpt-3.5-turbo");
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", "You are an assistant that formats email notifications as JSON."),
                    Map.of("role", "user", "content", prompt)
            ));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(openAiApiUrl, entity, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            String content = root.path("choices").get(0).path("message").path("content").asText();

            JsonNode aiResponse = objectMapper.readTree(content);
            String subject = aiResponse.path("subject").asText();
            String body = aiResponse.path("body").asText();

            emailNotificationSender.sendNotification(requestDto.getTo(), subject, body);
            log.info("Successfully sent AI-generated notification to {}", requestDto.getTo());

        } catch (Exception e) {
            log.error("Failed to generate or send AI notification", e);
            throw new RuntimeException("Error processing AI notification", e);
        }
    }
}
