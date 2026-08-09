package com.careeros.tasks.service;

import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.UserRepository;
import com.careeros.tasks.dto.*;
import com.careeros.tasks.entity.Task;
import com.careeros.tasks.repository.TaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class TaskService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_PAUSED = "PAUSED";
    private static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    private static final int MAX_TASKS_PER_USER = 500;
    private static final java.util.Set<String> VALID_STATUSES =
            java.util.Set.of(STATUS_PENDING, STATUS_COMPLETED, STATUS_PAUSED, STATUS_IN_PROGRESS);

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TaskAiService ai;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository, TaskAiService ai) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.ai = ai;
    }

    // ------------------------------------------------------------------
    // CRUD
    // ------------------------------------------------------------------

    @Transactional
    public TaskDto createTask(String userEmail, CreateTaskRequest request) {
        if (request.title() == null || request.title().isBlank()) {
            throw new BadRequestException("Task title cannot be empty.");
        }
        String title = request.title().trim();
        if (title.length() > 255) {
            throw new BadRequestException("Task title is too long (max 255 characters).");
        }
        User user = resolveUser(userEmail);
        if (taskRepository.countByUserId(user.getId()) >= MAX_TASKS_PER_USER) {
            throw new BadRequestException("You have reached the maximum of " + MAX_TASKS_PER_USER + " tasks. Delete some tasks before adding more.");
        }
        Task task = Task.builder()
                .user(user)
                .title(title)
                .status(STATUS_PENDING)
                .deadline(parseDeadline(request.deadline()))
                .build();
        taskRepository.save(task);
        return toDto(task);
    }

    public List<TaskDto> getTasks(String userEmail, String status) {
        User user = resolveUser(userEmail);
        List<Task> tasks;
        if (status != null && !status.isBlank()) {
            tasks = taskRepository.findByUserIdAndStatusOrderByDeadlineAscCreatedAtAsc(user.getId(), normalizeStatus(status));
        } else {
            tasks = taskRepository.findByUserIdOrderByDeadlineAscCreatedAtAsc(user.getId());
        }
        return tasks.stream().map(this::toDto).collect(Collectors.toList());
    }

    public TaskDto getTask(String userEmail, String id) {
        Task task = requireTask(userEmail, id);
        return toDto(task);
    }

    @Transactional
    public TaskDto updateTask(String userEmail, String id, UpdateTaskRequest request) {
        Task task = requireTask(userEmail, id);
        boolean changed = false;
        if (request.title() != null && !request.title().isBlank()) {
            String title = request.title().trim();
            if (title.length() > 255) {
                throw new BadRequestException("Task title is too long (max 255 characters).");
            }
            task.setTitle(title);
            changed = true;
        }
        if (request.status() != null && !request.status().isBlank()) {
            task.setStatus(normalizeStatus(request.status()));
            changed = true;
        }
        if (request.deadline() != null) {
            task.setDeadline(parseDeadline(request.deadline()));
            changed = true;
        }
        if (changed) {
            taskRepository.save(task);
        }
        return toDto(task);
    }

    @Transactional
    public void deleteTask(String userEmail, String id) {
        Task task = requireTask(userEmail, id);
        taskRepository.delete(task);
    }

    // ------------------------------------------------------------------
    // Summary / dashboard
    // ------------------------------------------------------------------

    public TaskSummaryResponse getSummary(String userEmail) {
        User user = resolveUser(userEmail);
        long total = taskRepository.countByUserId(user.getId());
        long completed = taskRepository.countByUserIdAndStatus(user.getId(), STATUS_COMPLETED);
        long pending = taskRepository.countByUserIdAndStatus(user.getId(), STATUS_PENDING);
        long overdue = taskRepository.findByUserIdAndStatusAndDeadlineLessThan(user.getId(), STATUS_PENDING, LocalDate.now().atStartOfDay()).size();
        return new TaskSummaryResponse(total, completed, pending, overdue);
    }

    // ------------------------------------------------------------------
    // AI planner
    // ------------------------------------------------------------------

    public AiPlanResponse generateAiPlan(String userEmail) {
        User user = resolveUser(userEmail);
        List<Task> pending = taskRepository.findByUserIdAndStatusOrderByDeadlineAscCreatedAtAsc(user.getId(), STATUS_PENDING);
        if (pending.isEmpty()) {
            throw new BadRequestException("You have no pending tasks. Add some tasks first, then ask the AI to plan.");
        }
        List<String> lines = pending.stream()
                .map(t -> t.getTitle() + (t.getDeadline() == null
                        ? " (no deadline)"
                        : " (deadline: " + t.getDeadline().toLocalDate() + ")"))
                .collect(Collectors.toList());
        String plan = ai.generatePlan(lines);
        return new AiPlanResponse(plan == null ? "" : plan);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User resolveUser(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    private Task requireTask(String userEmail, String id) {
        User user = resolveUser(userEmail);
        return taskRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new BadRequestException("Task not found or access denied"));
    }

    private String normalizeStatus(String status) {
        String s = status.trim().toUpperCase();
        if (!VALID_STATUSES.contains(s)) {
            throw new BadRequestException("Invalid task status: " + status);
        }
        return s;
    }

    private LocalDateTime parseDeadline(String deadline) {
        if (deadline == null || deadline.isBlank()) {
            return null;
        }
        String trimmed = deadline.trim();
        try {
            LocalDateTime dateTime = LocalDateTime.parse(trimmed);
            return dateTime;
        } catch (DateTimeParseException ignored) {
            // fall through to date-only
        }
        try {
            LocalDate date = LocalDate.parse(trimmed);
            return date.atTime(LocalTime.of(23, 59));
        } catch (DateTimeParseException e) {
            throw new BadRequestException("Invalid deadline format. Use YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.");
        }
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
}
