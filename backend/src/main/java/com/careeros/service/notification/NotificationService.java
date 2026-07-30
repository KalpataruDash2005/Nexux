package com.careeros.service.notification;

public interface NotificationService {
    void sendNotification(String to, String subject, String message);
}
