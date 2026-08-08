package com.careeros.controller;

import com.careeros.dto.NotificationRequestDto;
import com.careeros.service.notification.AiNotificationService;
import com.careeros.tasks.dto.TaskSummaryResponse;
import com.careeros.tasks.service.TaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final AiNotificationService aiNotificationService;
    private final TaskService taskService;

    @PostMapping
    public ResponseEntity<String> sendNotification(@RequestBody NotificationRequestDto requestDto) {
        aiNotificationService.processAndSendNotification(requestDto);
        return ResponseEntity.ok("Notification request processed successfully");
    }

    @PostMapping("/pending-work")
    public ResponseEntity<Map<String, Object>> sendPendingWorkReminder() {
        String email = getCurrentUserEmail();
        TaskSummaryResponse summary = taskService.getSummary(email);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("total", summary.total());
        payload.put("completed", summary.completed());
        payload.put("pending", summary.pending());
        payload.put("overdue", summary.overdue());

        if (summary.pending() + summary.overdue() > 0) {
            String details = summary.overdue() + " overdue and " + summary.pending()
                    + " pending out of " + summary.total() + " total tasks. "
                    + "Please prioritize the overdue and pending items first.";
            NotificationRequestDto dto = new NotificationRequestDto();
            dto.setTo(email);
            dto.setEventType("PENDING_WORK");
            dto.setRecipientName(email);
            dto.setAdditionalData(details);
            try {
                aiNotificationService.processAndSendNotification(dto);
            } catch (Exception e) {
                log.error("Failed to send pending-work reminder to {}", email, e);
            }
        }
        return ResponseEntity.ok(payload);
    }

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }
}
