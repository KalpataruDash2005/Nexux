package com.careeros.tasks.service;

import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.UserRepository;
import com.careeros.tasks.dto.AssistantAiOutput;
import com.careeros.tasks.dto.ConversationMessage;
import com.careeros.tasks.entity.AiConversation;
import com.careeros.tasks.entity.AiMemory;
import com.careeros.tasks.repository.AiConversationRepository;
import com.careeros.tasks.repository.AiMemoryRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TaskMemoryService {

    private static final int MAX_HISTORY_LIMIT = 50;

    private final AiConversationRepository conversationRepository;
    private final AiMemoryRepository memoryRepository;
    private final UserRepository userRepository;

    public TaskMemoryService(AiConversationRepository conversationRepository,
                             AiMemoryRepository memoryRepository,
                             UserRepository userRepository) {
        this.conversationRepository = conversationRepository;
        this.memoryRepository = memoryRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void saveMessage(String userEmail, String role, String content, String taskId) {
        User user = resolveUser(userEmail);
        AiConversation message = AiConversation.builder()
                .user(user)
                .role(role)
                .content(content)
                .taskId(taskId)
                .build();
        conversationRepository.save(message);
    }

    public List<ConversationMessage> history(String userEmail, int limit) {
        User user = resolveUser(userEmail);
        int clamped = Math.max(1, Math.min(limit <= 0 ? 20 : limit, MAX_HISTORY_LIMIT));
        List<AiConversation> recent = conversationRepository.findRecentByUserId(user.getId(), PageRequest.of(0, clamped));
        List<ConversationMessage> result = new ArrayList<>();
        for (AiConversation message : recent) {
            result.add(new ConversationMessage(
                    message.getId(),
                    message.getRole(),
                    message.getContent(),
                    message.getCreatedAt() == null ? null : message.getCreatedAt().toString()));
        }
        Collections.reverse(result);
        return result;
    }

    public Map<String, String> memory(String userEmail) {
        User user = resolveUser(userEmail);
        List<AiMemory> entries = memoryRepository.findByUserId(user.getId());
        Map<String, String> result = new LinkedHashMap<>();
        for (AiMemory entry : entries) {
            result.put(entry.getKey(), entry.getValue());
        }
        return result;
    }

    @Transactional
    public void applyMemoryUpdates(String userEmail, List<AssistantAiOutput.MemoryUpdate> updates) {
        if (updates == null || updates.isEmpty()) {
            return;
        }
        User user = resolveUser(userEmail);
        for (AssistantAiOutput.MemoryUpdate update : updates) {
            if (update == null || update.key == null || update.key.isBlank()) {
                continue;
            }
            upsert(user, update.key.trim(), update.value == null ? "" : update.value.trim());
        }
    }

    @Transactional
    public void setMemory(String userEmail, String key, String value) {
        if (key == null || key.isBlank()) {
            return;
        }
        User user = resolveUser(userEmail);
        upsert(user, key.trim(), value == null ? "" : value);
    }

    public String memorySummary(String userEmail) {
        Map<String, String> entries = memory(userEmail);
        if (entries.isEmpty()) {
            return "";
        }
        return entries.entrySet().stream()
                .map(e -> e.getKey() + ": " + e.getValue())
                .collect(Collectors.joining("; "));
    }

    private void upsert(User user, String key, String value) {
        String trimmedKey = key.length() > 64 ? key.substring(0, 64) : key;
        String trimmedValue = value.length() > 500 ? value.substring(0, 500) : value;
        AiMemory memory = memoryRepository.findByUserIdAndKey(user.getId(), trimmedKey)
                .orElseGet(() -> AiMemory.builder()
                        .user(user)
                        .key(trimmedKey)
                        .build());
        memory.setValue(trimmedValue);
        memory.setUpdatedAt(LocalDateTime.now());
        memoryRepository.save(memory);
    }

    private User resolveUser(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }
}
