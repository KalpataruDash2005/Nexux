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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class TaskAssistantService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_PAUSED = "PAUSED";
    private static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    private static final Map<String, String> STATUS_NORMALIZATION = Map.of(
            "pending", STATUS_PENDING,
            "completed", STATUS_COMPLETED,
            "paused", STATUS_PAUSED,
            "in_progress", STATUS_IN_PROGRESS,
            "in-progress", STATUS_IN_PROGRESS
    );

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TaskAssistantAiService ai;
    private final TaskMemoryService memoryService;
    private final TaskSchedulerService schedulerService;
    private final TaskContextService contextService;

    public TaskAssistantService(TaskRepository taskRepository,
                                UserRepository userRepository,
                                TaskAssistantAiService ai,
                                TaskMemoryService memoryService,
                                TaskSchedulerService schedulerService,
                                TaskContextService contextService) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.ai = ai;
        this.memoryService = memoryService;
        this.schedulerService = schedulerService;
        this.contextService = contextService;
    }

    /**
     * Process a natural-language instruction from the assistant widget.
     * The LLM decides the action; this method executes the returned JSON:
     *  - updates the targeted task (status / progress_notes / deadline) from {@code updates}
     *  - inserts micro-task chunks linked via {@code parent_task_id} from {@code new_chunks}
     *  - persists the conversation turn + any expressed preferences into memory
     *  - returns the friendly reply + the created chunks so the UI can refresh immediately
     */
    @Transactional
    public AssistantResponse handle(AssistantRequest request) {
        String message = request.message() == null ? "" : request.message().trim();
        if (message.isBlank()) {
            throw new BadRequestException("Please type or speak a message for the AI assistant.");
        }

        String userEmail = currentUserEmail();
        memoryService.saveMessage(userEmail, "USER", message, request.taskId());

        User user = resolveUser(userEmail);
        Task contextTask = null;
        if (request.taskId() != null && !request.taskId().isBlank()) {
            contextTask = taskRepository.findByIdAndUserId(request.taskId(), user.getId())
                    .orElseThrow(() -> new BadRequestException("Task not found or access denied"));
        }

        // Build the prompt: system enforces the schema, user carries task context + instruction.
        String timezone = request.timezone() == null || request.timezone().isBlank() ? "UTC" : request.timezone();
        AssistantContextResponse context = contextService.buildContext(userEmail, request.taskId(), request.pageContext(), timezone);
        String system = systemPrompt();
        String userMessage = userPrompt(context, message, request.pageContext());
        AssistantAiOutput output = ai.parseIntent(system, userMessage);

        Task updated = null;
        if (contextTask != null && output.updates != null) {
            updated = applyUpdates(contextTask, output.updates);
        }

        List<AssistantChunkDto> chunks = createChunks(user, contextTask, output);

        String reply = output.replyMessage == null || output.replyMessage.isBlank()
                ? defaultReply(contextTask, output)
                : output.replyMessage.trim();
        String action = output.action == null ? "chat" : output.action;

        memoryService.saveMessage(userEmail, "AI", reply, request.taskId());
        memoryService.applyMemoryUpdates(userEmail, output.memoryUpdatesOrEmpty());

        return new AssistantResponse(reply, action, updated == null ? null : toDto(updated), chunks);
    }

    // ------------------------------------------------------------------
    // Prompt engineering
    // ------------------------------------------------------------------

    private String systemPrompt() {
        return "You are a smart productivity assistant. The user will give you instructions regarding their tasks "
                + "(e.g., pausing a task, setting a new deadline, or asking to divide a task). "
                + "Your job is to understand the context. If the user says 'I am done for today, resume this over the next 4 days', you must:\n"
                + "1. Mark the current task as paused.\n"
                + "2. Break the remaining work of that task into small, actionable chunks.\n"
                + "3. Distribute these chunks logically across the requested timeframe (next 4 days).\n"
                + "If the user asks to create a plan or roadmap (e.g. 'create a 7-day roadmap for learning .NET' or "
                + "'make a study plan for this week'), you must return new_chunks with one chunk per day/session, "
                + "each with a scheduled_date spread across the requested number of days starting tomorrow. "
                + "Leave updates empty/null in that case unless the user also asked to modify a task.\n"
                + "Respond strictly in JSON format matching this schema (keys are snake_case):\n"
                + "{\n"
                + "  \"reply_message\": \"Friendly confirmation message to show the user\",\n"
                + "  \"action\": \"pause_and_chunk\",\n"
                + "  \"updates\": { \"status\": \"paused\", \"progress_notes\": \"string\", \"deadline\": null },\n"
                + "  \"new_chunks\": [\n"
                + "    { \"title\": \"Chunk 1 description\", \"scheduled_date\": \"YYYY-MM-DD\" }\n"
                + "  ],\n"
                + "  \"memory_updates\": [\n"
                + "    { \"key\": \"e.g. preferred_work_hours\", \"value\": \"mornings\" }\n"
                + "  ]\n"
                + "}\n"
                + "Allowed values for status: pending, in_progress, paused, completed. "
                + "deadline is optional: either null or a YYYY-MM-DD date. "
                + "\"memory_updates\" is OPTIONAL: use it when the user expresses a preference or habit "
                + "(e.g. \"I work best in the mornings\"); otherwise return an empty array. "
                + "Each chunk may optionally include \"estimated_hours\": \"2.5\". "
                + "If the user only asks a question or gives a general tip, return an empty new_chunks array, "
                + "a chat action, and a helpful reply_message. Always reply with ONLY valid JSON.";
    }

    private String userPrompt(AssistantContextResponse context, String message, String pageContext) {
        StringBuilder sb = new StringBuilder();
        sb.append("The user is on the Task Manager page.");
        if (pageContext != null && !pageContext.isBlank()) {
            sb.append("\nCurrent page context: ").append(pageContext);
        }
        sb.append("\n\nCurrent time: ").append(context.now()).append(" (").append(context.timezone()).append(")");
        TaskDto active = context.activeTask();
        if (active != null) {
            sb.append("\n\nCurrent active task:\n");
            sb.append("- id: ").append(active.id()).append("\n");
            sb.append("- title: ").append(active.title()).append("\n");
            sb.append("- status: ").append(active.status()).append("\n");
            sb.append("- deadline: ").append(active.deadline() == null ? "none" : active.deadline()).append("\n");
            sb.append("- progress notes: ").append(active.progressNotes() == null ? "none" : active.progressNotes());
        } else {
            sb.append("\n\nNo specific task is active right now.");
        }
        List<TaskDto> recent = context.recentTasks();
        if (recent != null && !recent.isEmpty()) {
            sb.append("\n\nRecent tasks:");
            int count = 0;
            for (TaskDto t : recent) {
                if (count >= 6) {
                    break;
                }
                sb.append("\n- ").append(t.title())
                        .append(" | status: ").append(t.status())
                        .append(" | deadline: ").append(t.deadline() == null ? "none" : t.deadline());
                count++;
            }
        }
        List<TaskDto> upcoming = context.upcomingDeadlines();
        if (upcoming != null && !upcoming.isEmpty()) {
            sb.append("\n\nUpcoming deadlines:");
            int count = 0;
            for (TaskDto t : upcoming) {
                if (count >= 3) {
                    break;
                }
                sb.append("\n- ").append(t.title())
                        .append(" | deadline: ").append(t.deadline() == null ? "none" : t.deadline());
                count++;
            }
        }
        Map<String, String> memory = context.memory();
        if (memory != null && !memory.isEmpty()) {
            sb.append("\n\nUser preferences/memory:");
            for (Map.Entry<String, String> entry : memory.entrySet()) {
                sb.append("\n- ").append(entry.getKey()).append(": ").append(entry.getValue());
            }
        }
        String conversation = context.conversationSummary();
        if (conversation != null && !conversation.isBlank()) {
            sb.append("\n\nRecent conversation:\n").append(conversation);
        }
        sb.append("\n\nUser instruction: \"").append(message).append("\"\n");
        sb.append("Respond with the strict JSON schema. If the instruction modifies a task, populate 'updates' and "
                + "'new_chunks' as appropriate. Distribute chunks across the requested timeframe and keep them small and actionable.");
        return sb.toString();
    }

    // ------------------------------------------------------------------
    // Database execution
    // ------------------------------------------------------------------

    private Task applyUpdates(Task task, AssistantAiOutput.AiUpdates updates) {
        boolean changed = false;
        if (updates.status != null && !updates.status.isBlank()) {
            String status = normalizeStatus(updates.status);
            LocalDateTime now = LocalDateTime.now();
            task.setStatus(status);
            if (STATUS_PAUSED.equals(status)) {
                task.setPausedAt(now);
                task.setLastActivity(now);
            } else if (STATUS_IN_PROGRESS.equals(status)) {
                if (task.getStartedAt() == null) {
                    task.setStartedAt(now);
                }
                task.setLastActivity(now);
            } else if (STATUS_COMPLETED.equals(status)) {
                task.setCompletedAt(now);
                task.setLastActivity(now);
            }
            changed = true;
        }
        if (updates.progressNotes != null && !updates.progressNotes.isBlank()) {
            task.setProgressNotes(updates.progressNotes.trim());
            changed = true;
        }
        if (updates.deadline != null && !updates.deadline.isBlank()) {
            task.setDeadline(parseDeadline(updates.deadline));
            changed = true;
        }
        if (changed) {
            taskRepository.save(task);
        }
        return task;
    }

    private List<AssistantChunkDto> createChunks(User user, Task parent, AssistantAiOutput output) {
        List<AssistantChunkDto> result = new ArrayList<>();
        if (output.newChunks == null || output.newChunks.isEmpty()) {
            return result;
        }
        List<Task> saved = new ArrayList<>();
        int fallbackDay = 1;
        for (AssistantAiOutput.AiChunk chunk : output.newChunks) {
            if (chunk.title == null || chunk.title.isBlank()) {
                continue;
            }
            String resolved = schedulerService.resolveScheduledDate(user.getEmail(), chunk.scheduledDate);
            if (resolved == null) {
                // No date suggested (or invalid): spread chunks over the next days
                // so they still land on the calendar.
                resolved = schedulerService.resolveScheduledDate(
                        user.getEmail(), LocalDate.now().plusDays(fallbackDay).toString());
            }
            fallbackDay++;
            Task micro = Task.builder()
                    .user(user)
                    .title(chunk.title.trim())
                    .status(STATUS_PENDING)
                    .parentTask(parent)
                    .deadline(parseScheduledDate(resolved))
                    .estimatedHours(parseHours(chunk.estimatedHours))
                    .build();
            taskRepository.save(micro);
            saved.add(micro);
            result.add(new AssistantChunkDto(
                    micro.getId(),
                    micro.getTitle(),
                    micro.getStatus(),
                    micro.getDeadline() == null ? null : micro.getDeadline().toLocalDate().toString()));
        }
        if (!saved.isEmpty()) {
            schedulerService.stampChunks(saved, saved.size());
            if (parent != null && parent.getRemainingHours() == null) {
                BigDecimal sum = sumHours(saved);
                if (sum != null) {
                    parent.setRemainingHours(sum);
                    taskRepository.save(parent);
                }
            }
        }
        return result;
    }

    private String defaultReply(Task contextTask, AssistantAiOutput output) {
        if (output.newChunks != null && !output.newChunks.isEmpty()) {
            return "Done! I've split \"" + (contextTask == null ? "your task" : contextTask.getTitle())
                    + "\" into " + output.newChunks.size() + " smaller chunks on your calendar. You've got this!";
        }
        return "Got it! Your tasks are updated.";
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private String currentUserEmail() {
        return org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getName();
    }

    private User resolveUser(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    private String normalizeStatus(String status) {
        String key = status.trim().toLowerCase();
        String mapped = STATUS_NORMALIZATION.get(key);
        if (mapped == null) {
            throw new BadRequestException("Invalid task status: " + status);
        }
        return mapped;
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
            return LocalDate.parse(trimmed).atTime(LocalTime.of(23, 59));
        } catch (DateTimeParseException e) {
            throw new BadRequestException("Invalid deadline format: " + deadline);
        }
    }

    private LocalDateTime parseScheduledDate(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(date.trim()).atTime(LocalTime.of(23, 59));
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private BigDecimal parseHours(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private BigDecimal sumHours(List<Task> chunks) {
        BigDecimal sum = BigDecimal.ZERO;
        boolean any = false;
        for (Task chunk : chunks) {
            if (chunk.getEstimatedHours() != null) {
                sum = sum.add(chunk.getEstimatedHours());
                any = true;
            }
        }
        return any ? sum : null;
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
