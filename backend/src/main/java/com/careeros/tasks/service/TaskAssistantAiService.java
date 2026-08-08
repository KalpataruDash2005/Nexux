package com.careeros.tasks.service;

import com.careeros.exception.BadRequestException;
import com.careeros.tasks.config.TaskProperties;
import com.careeros.tasks.dto.AssistantAiOutput;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class TaskAssistantAiService {

    private static final int LLM_MAX_RETRIES = 5;
    private static final int JSON_MAX_ATTEMPTS = 3;

    private final TaskProperties props;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public TaskAssistantAiService(TaskProperties props, RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.props = props;
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    /**
     * Ask the LLM to produce structured output for the Smart AI Task Assistant.
     * The system prompt enforces the exact schema requested (reply_message / action / updates / new_chunks)
     * and the call uses OpenAI-compatible JSON mode + a strict JSON-parsing retry loop.
     */
    public AssistantAiOutput parseIntent(String system, String user) {
        String current = user;
        for (int attempt = 1; attempt <= JSON_MAX_ATTEMPTS; attempt++) {
            String raw = postCompletion(body(system, current));
            try {
                return objectMapper.readValue(cleanJson(raw), AssistantAiOutput.class);
            } catch (Exception e) {
                log.warn("Assistant AI JSON parse failed (attempt {}/{}): {}", attempt, JSON_MAX_ATTEMPTS, safeMessage(e));
                current = user + "\n\nYour previous response was not valid JSON matching the requested schema. "
                        + "Reply with ONLY valid JSON using the exact keys: reply_message, action, updates, new_chunks. No prose, no code fences.";
            }
        }
        throw new BadRequestException("AI returned invalid JSON after " + JSON_MAX_ATTEMPTS + " attempts");
    }

    // ------------------------------------------------------------------
    // LLM plumbing (mirrors PlacementAiService retry/backoff pattern)
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
        body.put("temperature", 0.3);
        body.put("max_tokens", 2048);
        body.put("response_format", Map.of("type", "json_object"));
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
                log.warn("Assistant AI rate limited (attempt {}), retrying in {} ms", attempt, waitMs);
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

    private String cleanJson(String raw) {
        if (raw == null) {
            return "{}";
        }
        String s = raw.trim();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) {
                s = s.substring(nl + 1);
            }
            s = s.replaceAll("```\\s*$", "").trim();
        }
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return s.substring(start, end + 1);
        }
        return s;
    }

    private String safeMessage(Throwable t) {
        if (t == null) {
            return "unknown error";
        }
        String m = t.getMessage();
        return m == null ? t.getClass().getSimpleName() : m;
    }
}
