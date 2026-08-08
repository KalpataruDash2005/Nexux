package com.careeros.tasks.service;

import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.UserRepository;
import com.careeros.tasks.dto.AssistantContextResponse;
import com.careeros.tasks.dto.ConversationMessage;
import com.careeros.tasks.dto.TaskDto;
import com.careeros.tasks.entity.Task;
import com.careeros.tasks.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class TaskContextService {

    private static final int SUMMARY_LINE_MAX_CHARS = 200;

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TaskMemoryService memoryService;

    public TaskContextService(TaskRepository taskRepository,
                              UserRepository userRepository,
                              TaskMemoryService memoryService) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.memoryService = memoryService;
    }

    public AssistantContextResponse buildContext(String userEmail, String taskId, String pageContext, String timezone) {
        User user = resolveUser(userEmail);

        Task activeTask = null;
        if (taskId != null && !taskId.isBlank()) {
            activeTask = taskRepository.findByIdAndUserId(taskId, user.getId()).orElse(null);
        }

        List<Task> recent = taskRepository.findTop10ByUserIdOrderByDeadlineAscCreatedAtAsc(user.getId());
        List<Task> upcoming = taskRepository
                .findByUserIdAndStatusAndDeadlineGreaterThanOrderByDeadlineAsc(user.getId(), "PENDING", LocalDateTime.now());
        if (upcoming.size() > 5) {
            upcoming = upcoming.subList(0, 5);
        }

        Map<String, String> memory = memoryService.memory(userEmail);
        List<ConversationMessage> history = memoryService.history(userEmail, 6);

        return new AssistantContextResponse(
                LocalDateTime.now().toString(),
                timezone == null || timezone.isBlank() ? "UTC" : timezone,
                activeTask == null ? null : toDto(activeTask),
                toDtos(recent),
                toDtos(upcoming),
                memory,
                conversationSummary(history));
    }

    private String conversationSummary(List<ConversationMessage> history) {
        if (history == null || history.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (ConversationMessage message : history) {
            String content = message.content() == null ? "" : message.content();
            if (content.length() > SUMMARY_LINE_MAX_CHARS) {
                content = content.substring(0, SUMMARY_LINE_MAX_CHARS);
            }
            if (sb.length() > 0) {
                sb.append("\n");
            }
            sb.append(message.role()).append(": ").append(content);
        }
        return sb.toString();
    }

    private List<TaskDto> toDtos(List<Task> tasks) {
        List<TaskDto> result = new ArrayList<>();
        if (tasks == null) {
            return result;
        }
        for (Task task : tasks) {
            result.add(toDto(task));
        }
        return result;
    }

    private TaskDto toDto(Task task) {
        return new TaskDto(
                task.getId(),
                task.getTitle(),
                task.getStatus(),
                task.getProgressNotes(),
                task.getParentTask() == null ? null : task.getParentTask().getId(),
                task.getDeadline() == null ? null : task.getDeadline().toString(),
                task.getCreatedAt() == null ? null : task.getCreatedAt().toString(),
                task.getEstimatedHours() == null ? null : task.getEstimatedHours().toPlainString(),
                task.getRemainingHours() == null ? null : task.getRemainingHours().toPlainString(),
                task.getChunkIndex(),
                task.getTotalChunks(),
                task.isAiGenerated(),
                task.getStartedAt() == null ? null : task.getStartedAt().toString(),
                task.getPausedAt() == null ? null : task.getPausedAt().toString(),
                task.getCompletedAt() == null ? null : task.getCompletedAt().toString(),
                task.getLastActivity() == null ? null : task.getLastActivity().toString()
        );
    }

    private User resolveUser(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }
}
