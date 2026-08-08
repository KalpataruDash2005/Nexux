package com.careeros.tasks.service;

import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.UserRepository;
import com.careeros.tasks.entity.Task;
import com.careeros.tasks.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class TaskSchedulerService {

    private static final int MAX_CONFLICT_SHIFT_DAYS = 30;

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public TaskSchedulerService(TaskRepository taskRepository, UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    /**
     * Resolves a proposed scheduling date, shifting forward day by day until it does not
     * collide with any existing PENDING task deadline of the user (max 30 days of shifting).
     */
    public String resolveScheduledDate(String userEmail, String proposedDate) {
        if (proposedDate == null || proposedDate.isBlank()) {
            return null;
        }
        LocalDate date;
        try {
            date = LocalDate.parse(proposedDate.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
        User user = resolveUser(userEmail);
        for (int i = 0; i < MAX_CONFLICT_SHIFT_DAYS; i++) {
            if (!isDayOccupied(user.getId(), date)) {
                return date.toString();
            }
            date = date.plusDays(1);
        }
        return date.toString();
    }

    /**
     * Marks a list of freshly created chunks with their index, total count, ai_generated flag,
     * and initializes remaining_hours from estimated_hours when present.
     */
    public void stampChunks(List<Task> chunks, int totalChunks) {
        for (int i = 0; i < chunks.size(); i++) {
            Task chunk = chunks.get(i);
            chunk.setChunkIndex(i + 1);
            chunk.setTotalChunks(totalChunks);
            chunk.setAiGenerated(true);
            if (chunk.getEstimatedHours() != null) {
                chunk.setRemainingHours(chunk.getEstimatedHours());
            }
        }
    }

    private boolean isDayOccupied(String userId, LocalDate date) {
        List<Task> conflicts = taskRepository
                .findByUserIdAndDeadlineIsNotNullAndDeadlineBetweenOrderByDeadlineAsc(
                        userId, date.atStartOfDay(), date.atTime(LocalTime.MAX));
        for (Task task : conflicts) {
            if ("PENDING".equals(task.getStatus())) {
                return true;
            }
        }
        return false;
    }

    private User resolveUser(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }
}
