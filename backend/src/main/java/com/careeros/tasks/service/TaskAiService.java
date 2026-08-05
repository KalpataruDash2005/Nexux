package com.careeros.tasks.service;

import com.careeros.exception.BadRequestException;
import com.careeros.tasks.config.TaskProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class TaskAiService {

    private static final int LLM_MAX_RETRIES = 5;

    private final TaskProperties props;
    private final RestClient.Builder restClientBuilder;

    public TaskAiService(TaskProperties props, RestClient.Builder restClientBuilder) {
        this.props = props;
        this.restClientBuilder = restClientBuilder;
    }

    public String generatePlan(List<String> pendingTasks) {
        if (pendingTasks == null || pendingTasks.isEmpty()) {
            throw new BadRequestException("You have no pending tasks. Add some tasks first, then ask the AI to plan.");
        }
        String system = "You are an expert productivity coach. You help students stay stress-free, organized, and on time. "
                + "You output clear, motivating, easy-to-follow step-by-step plans in Markdown. "
                + "You never invent tasks that were not provided; you only reorganize and schedule the given tasks.";
        String user = "You are an expert productivity coach. The user has the following pending tasks with their "
                + "respective deadlines: " + tasksBlock(pendingTasks) + "\n"
                + "Create a highly optimized, easy-to-execute, and stress-free step-by-step plan for the user to "
                + "complete these tasks before their deadlines. Prioritize urgent and overdue items first, break "
                + "large tasks into small daily chunks, and include practical time-boxed suggestions. "
                + "Reply in Markdown with a short intro, a numbered step-by-step plan, and a brief closing tip.";
        return postCompletion(body(system, user));
    }

    private String tasksBlock(List<String> pendingTasks) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < pendingTasks.size(); i++) {
            sb.append("\n  ").append(i + 1).append(". ").append(pendingTasks.get(i));
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------
    // LLM plumbing
    // ------------------------------------------------------------------

    private Map<String, Object> body(String system, String user) {
        List<Map<String, Object>> messages = new ArrayList<>();
        Map<String, Object> sys = new LinkedHashMap<>();
        sys.put("role", "system");
        sys.put("content", system);
        messages.add(sys);
        Map<String, Object> usr = new LinkedHashMap<>();
        usr.put("role", "user");
        usr.put("content", user);
        messages.add(usr);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.getLlmModel());
        body.put("temperature", 0.6);
        body.put("max_tokens", 2048);
        body.put("messages", messages);
        return body;
    }

    private String postCompletion(Map<String, Object> body) {
        Exception lastError = null;
        for (int attempt = 1; attempt <= LLM_MAX_RETRIES; attempt++) {
            try {
                Map<?, ?> json = restClientBuilder.build()
                        .post()
                        .uri(props.getLlmBaseUrl() + "/chat/completions")
                        .header("Authorization", "Bearer " + props.getLlmApiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(Map.class);
                if (json == null) {
                    throw new IllegalStateException("LLM returned an empty response");
                }
                List<?> choices = (List<?>) json.get("choices");
                if (choices == null || choices.isEmpty()) {
                    throw new IllegalStateException("LLM returned no choices");
                }
                Object first = choices.get(0);
                if (!(first instanceof Map<?, ?>)) {
                    throw new IllegalStateException("Unexpected LLM response shape");
                }
                Object message = ((Map<?, ?>) first).get("message");
                if (!(message instanceof Map<?, ?>)) {
                    throw new IllegalStateException("Unexpected LLM message shape");
                }
                Object content = ((Map<?, ?>) message).get("content");
                return content == null ? "" : String.valueOf(content);
            } catch (Exception e) {
                lastError = e;
                String msg = e.getMessage() == null ? "" : e.getMessage();
                boolean rateLimited = msg.contains("rate_limit_exceeded") || msg.contains("429");
                if (!rateLimited || attempt == LLM_MAX_RETRIES) {
                    throw new BadRequestException("AI call failed: " + safeMessage(e));
                }
                long waitMs = retryDelayMs(msg, attempt);
                log.warn("Task AI rate limited (attempt {}), retrying in {} ms", attempt, waitMs);
                try {
                    Thread.sleep(waitMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new BadRequestException("Interrupted while waiting to retry AI call");
                }
            }
        }
        throw new BadRequestException("AI call failed after retries: " + safeMessage(lastError));
    }

    private long retryDelayMs(String message, int attempt) {
        Matcher m = Pattern.compile("try again in (\\d+(?:\\.\\d+)?)\\s*s")
                .matcher(message == null ? "" : message);
        if (m.find()) {
            long seconds = (long) Math.ceil(Double.parseDouble(m.group(1)));
            if (seconds >= 1 && seconds <= 120) {
                return seconds * 1000L;
            }
        }
        return Math.min(4000L * (1L << (attempt - 1)), 60000L);
    }

    private String safeMessage(Throwable t) {
        if (t == null) {
            return "unknown error";
        }
        String m = t.getMessage();
        return m == null ? t.getClass().getSimpleName() : m;
    }
}
