package com.careeros.planner.service;

import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.planner.config.PlannerProperties;
import com.careeros.planner.dto.*;
import com.careeros.planner.entity.AcademicEvent;
import com.careeros.planner.entity.StudyPlanItem;
import com.careeros.planner.repository.AcademicEventRepository;
import com.careeros.planner.repository.StudyPlanItemRepository;
import com.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlannerStudyService {

    private static final int MAX_PLAN_DAYS = 60;
    private static final int MAX_PLAN_SESSIONS_PER_DAY = 8;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final PlannerProperties props;
    private final AcademicEventRepository eventRepository;
    private final StudyPlanItemRepository studyItemRepository;
    private final UserRepository userRepository;
    private final RestClient.Builder restClientBuilder;

    // ------------------------------------------------------------------
    // Study plan generation
    // ------------------------------------------------------------------

    public StudyPlanResponse generateStudyPlan(String ownerEmail, Integer requestedDays) {
        int days = requestedDays == null ? props.getDefaultPlanDays() : requestedDays;
        if (days < 1) {
            days = 1;
        }
        if (days > MAX_PLAN_DAYS) {
            days = MAX_PLAN_DAYS;
        }

        User owner = resolveOwner(ownerEmail);
        LocalDate today = LocalDate.now();
        LocalDate windowEnd = today.plusDays(days);

        List<AcademicEvent> events = eventRepository
                .findByOwnerIdAndEventDateGreaterThanEqualAndEventDateLessThanEqualOrderByEventDateAsc(
                        owner.getId(), today, windowEnd);

        String raw = callPlanLlm(buildPlanPrompt(events, today, windowEnd));
        List<StudyDayDraft> dayDrafts = parsePlanJson(raw);

        if (dayDrafts.isEmpty()) {
            studyItemRepository.deleteByOwnerId(owner.getId());
            return new StudyPlanResponse(today,
                    "No study plan could be generated because there are no upcoming academic events.",
                    List.of());
        }

        // Replace the plan for the covered window.
        List<StudyPlanItem> existing = studyItemRepository.findByOwnerIdAndPlanDateGreaterThanEqualAndPlanDateLessThanEqualOrderByPlanDateAsc(
                owner.getId(), today, windowEnd);
        studyItemRepository.deleteAll(existing);

        List<StudyPlanItem> saved = new ArrayList<>();
        for (StudyDayDraft day : dayDrafts) {
            if (day.date() == null || day.sessions() == null) {
                continue;
            }
            if (day.date().isBefore(today) || day.date().isAfter(windowEnd)) {
                continue;
            }
            for (StudySessionDraft session : day.sessions()) {
                if (session.subject() == null || session.subject().isBlank()) {
                    continue;
                }
                StudyPlanItem item = StudyPlanItem.builder()
                        .owner(owner)
                        .planDate(day.date())
                        .startTime(session.startTime())
                        .subject(session.subject().trim())
                        .hours(session.hours() == null || session.hours() <= 0 ? 1.0 : Math.min(session.hours(), 8.0))
                        .sessionType(normalizeType(session.type()))
                        .completed(false)
                        .build();
                saved.add(studyItemRepository.save(item));
            }
        }

        log.info("Generated study plan for {} covering {} days with {} sessions",
                ownerEmail, days, saved.size());
        return toPlanResponse(today, dayDrafts, saved);
    }

    public StudyPlanResponse getStudyPlan(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        LocalDate today = LocalDate.now();
        List<StudyPlanItem> items = studyItemRepository
                .findByOwnerIdAndPlanDateGreaterThanEqualOrderByPlanDateAscStartTimeAsc(owner.getId(), today)
                .stream()
                .filter(i -> !i.getPlanDate().isAfter(today.plusDays(6)))
                .collect(Collectors.toList());
        return buildPlanFromItems(today, items);
    }

    public DailyScheduleResponse getSchedule(String ownerEmail, LocalDate date) {
        User owner = resolveOwner(ownerEmail);
        LocalDate day = date == null ? LocalDate.now() : date;
        List<StudyPlanItem> items = studyItemRepository
                .findByOwnerIdAndPlanDateOrderByStartTimeAsc(owner.getId(), day);
        List<StudySlotResponse> slots = items.stream().map(StudySlotResponse::from).collect(Collectors.toList());
        double total = slots.stream().mapToDouble(StudySlotResponse::hours).sum();
        return new DailyScheduleResponse(day, total, slots);
    }

    public StudyPlanItem markSessionCompleted(String ownerEmail, String sessionId, boolean completed) {
        User owner = resolveOwner(ownerEmail);
        StudyPlanItem item = studyItemRepository.findById(sessionId)
                .filter(i -> i.getOwner().getId().equals(owner.getId()))
                .orElseThrow(() -> new BadRequestException("Study session not found or access denied"));
        item.setCompleted(completed);
        return studyItemRepository.save(item);
    }

    // ------------------------------------------------------------------
    // Today's focus (rule-based, always available)
    // ------------------------------------------------------------------

    public TodayFocusResponse getTodayFocus(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        LocalDate today = LocalDate.now();

        List<AcademicEvent> todayEvents = eventRepository.findByOwnerIdAndEventDate(owner.getId(), today);
        List<AcademicEvent> upcoming = eventRepository
                .findByOwnerIdAndEventDateGreaterThanEqualOrderByEventDateAsc(owner.getId(), today.plusDays(1));

        List<FocusItemResponse> focus = new ArrayList<>();

        // 1. Events happening today.
        for (AcademicEvent e : todayEvents) {
            if (!e.isCompleted()) {
                focus.add(new FocusItemResponse(
                        e.getId(), e.getTitle(), e.getCategory(), e.getPriority(),
                        e.getColor(), e.getEventDate(), 0,
                        estimatedHours(e), 0, "Happening today — " + describeEvent(e)));
            }
        }

        // 2. The most urgent upcoming deadline (exams/assignments/projects first).
        upcoming.stream()
                .filter(e -> !e.isCompleted())
                .sorted(Comparator
                        .comparing(AcademicEvent::getEventDate)
                        .thenComparing(e -> -priorityRank(e.getPriority())))
                .limit(2)
                .forEach(e -> {
                    long days = java.time.temporal.ChronoUnit.DAYS.between(today, e.getEventDate());
                    double estimate = estimatedHours(e);
                    double recommended = recommendedHours(e, days);
                    focus.add(new FocusItemResponse(
                            e.getId(), e.getTitle(), e.getCategory(), e.getPriority(),
                            e.getColor(), e.getEventDate(), days, estimate, recommended,
                            urgencyReason(e, days)));
                });

        if (focus.isEmpty()) {
            focus.add(new FocusItemResponse(
                    null, "No deadlines right now", "FREE", "LOW", "#22c55e",
                    today, 0, 0, 0, "Enjoy the calm — use this time to revise at your own pace."));
        }

        return new TodayFocusResponse(today, focus, buildRecommendations(todayEvents, upcoming, today));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private double estimatedHours(AcademicEvent e) {
        return switch (e.getCategory()) {
            case "EXAM", "INTERNAL_EXAM", "EXTERNAL_EXAM", "PRACTICAL_EXAM" -> 6.0;
            case "ASSIGNMENT", "SUBMISSION" -> 3.0;
            case "PROJECT", "HACKATHON" -> 4.0;
            case "PLACEMENT" -> 3.0;
            default -> 2.0;
        };
    }

    private double recommendedHours(AcademicEvent e, long days) {
        double estimate = estimatedHours(e);
        if (days <= 0) return estimate;
        if (days <= 2) return estimate;
        if (days <= 5) return Math.max(1, Math.round(estimate / days));
        return Math.max(1, Math.round(estimate / 3.0));
    }

    private String urgencyReason(AcademicEvent e, long days) {
        String when = days == 0 ? "today" : days == 1 ? "tomorrow" : "in " + days + " days";
        return switch (e.getCategory()) {
            case "EXAM", "INTERNAL_EXAM", "EXTERNAL_EXAM", "PRACTICAL_EXAM" ->
                    e.getTitle() + " starts " + when + " — start preparing now";
            case "ASSIGNMENT", "SUBMISSION" ->
                    e.getTitle() + " is due " + when;
            case "PROJECT", "HACKATHON" ->
                    e.getTitle() + " is " + when;
            default ->
                    e.getTitle() + " is " + when;
        };
    }

    private String describeEvent(AcademicEvent e) {
        if (e.getStartTime() != null) {
            return e.getTitle() + " at " + e.getStartTime().format(TIME_FMT);
        }
        return e.getTitle();
    }

    private List<String> buildRecommendations(List<AcademicEvent> todayEvents,
                                              List<AcademicEvent> upcoming,
                                              LocalDate today) {
        List<String> recommendations = new ArrayList<>();
        List<AcademicEvent> assignments = upcoming.stream()
                .filter(e -> (e.getCategory().equals("ASSIGNMENT") || e.getCategory().equals("SUBMISSION"))
                        && !e.isCompleted())
                .collect(Collectors.toList());
        if (!assignments.isEmpty()) {
            long weekAssignments = assignments.stream()
                    .filter(e -> java.time.temporal.ChronoUnit.DAYS.between(today, e.getEventDate()) <= 7)
                    .count();
            if (weekAssignments >= 2) {
                recommendations.add("You have " + weekAssignments + " assignments this week. "
                        + "Finish \"" + assignments.get(0).getTitle() + "\" today.");
            } else if (java.time.temporal.ChronoUnit.DAYS.between(today, assignments.get(0).getEventDate()) <= 2) {
                recommendations.add("\"" + assignments.get(0).getTitle() + "\" is due soon — "
                        + "prioritize it today.");
            }
        }

        upcoming.stream()
                .filter(e -> (e.getCategory().equals("EXAM") || e.getCategory().equals("INTERNAL_EXAM")
                        || e.getCategory().equals("EXTERNAL_EXAM") || e.getCategory().equals("PRACTICAL_EXAM"))
                        && !e.isCompleted())
                .sorted(Comparator.comparing(AcademicEvent::getEventDate))
                .findFirst()
                .ifPresent(exam -> {
                    long days = java.time.temporal.ChronoUnit.DAYS.between(today, exam.getEventDate());
                    if (days <= 10) {
                        double daily = Math.max(1.5, Math.round(estimatedHours(exam) / Math.max(1, days) * 10) / 10.0);
                        recommendations.add("Exam \"" + exam.getTitle() + "\" is in " + days
                                + " days. Study about " + daily + " hours/day to stay on track.");
                    }
                });

        if (recommendations.isEmpty()) {
            recommendations.add("No urgent deadlines. Use today to revise or get ahead on upcoming topics.");
        }
        return recommendations;
    }

    private int priorityRank(String priority) {
        return switch (priority == null ? "MEDIUM" : priority) {
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            default -> 1;
        };
    }

    private String normalizeType(String type) {
        if (type == null) {
            return "STUDY";
        }
        String t = type.toUpperCase().replaceAll("[^A-Z_]", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
        return switch (t) {
            case "REVISION", "REVIEW" -> "REVISION";
            case "PRACTICE", "PRACTICE_QUESTIONS", "PROBLEM" -> "PRACTICE";
            case "MOCK_TEST", "MOCK", "TEST" -> "MOCK_TEST";
            case "ASSIGNMENT", "HW" -> "ASSIGNMENT";
            case "BREAK" -> "BREAK";
            default -> "STUDY";
        };
    }

    private String inferSubject(String title, String category) {
        if (title == null) {
            return null;
        }
        String t = title.trim();
        int dash = t.lastIndexOf(" - ");
        if (dash >= 0) {
            t = t.substring(dash + 3).trim();
        }
        String lower = t.toLowerCase();
        if (lower.isBlank()) {
            return null;
        }
        if (lower.contains("all subjects") || lower.contains("classes begin")
                || lower.contains("orientation") || lower.contains("holiday")
                || lower.contains("semester") || lower.contains("sports")
                || lower.contains("placement") || lower.contains("subjects")) {
            return null;
        }
        if (lower.contains(" lab")) {
            return t.substring(0, lower.indexOf(" lab") + 4).trim();
        }
        t = t.replaceAll("^\\s*\\d+\\s*[:.\\-]\\s*", "").replaceAll("\\s+", " ").trim();
        if (t.length() < 2) {
            return null;
        }
        return t;
    }

    // ------------------------------------------------------------------
    // LLM plan generation
    // ------------------------------------------------------------------

    private String callPlanLlm(String prompt) {
        Map<String, Object> body = Map.of(
                "model", props.getLlmModel(),
                "temperature", 0.3,
                "max_tokens", 2048,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", buildPlanSystemPrompt()),
                        Map.of("role", "user", "content", prompt)
                )
        );
        Exception lastError = null;
        for (int attempt = 1; attempt <= 5; attempt++) {
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
                Object message = ((Map<?, ?>) choices.get(0)).get("message");
                if (!(message instanceof Map<?, ?>)) {
                    throw new IllegalStateException("Unexpected LLM response shape");
                }
                Object content = ((Map<?, ?>) message).get("content");
                return content == null ? "" : String.valueOf(content);
            } catch (Exception e) {
                lastError = e;
                String msg = e.getMessage() == null ? "" : e.getMessage();
                boolean rateLimited = msg.contains("rate_limit_exceeded") || msg.contains("429");
                if (!rateLimited || attempt == 5) {
                    throw new BadRequestException("Study plan generation failed: " + safeMessage(e));
                }
                long waitMs = retryDelayMs(msg, attempt);
                log.warn("Study plan LLM rate limited (attempt {}), retrying in {} ms", attempt, waitMs);
                try {
                    Thread.sleep(waitMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new BadRequestException("Interrupted while retrying study plan generation");
                }
            }
        }
        throw new BadRequestException("Study plan generation failed after retries: " + safeMessage(lastError));
    }

    private long retryDelayMs(String message, int attempt) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("try again in (\\d+(?:\\.\\d+)?)\\s*s")
                .matcher(message == null ? "" : message);
        if (m.find()) {
            long seconds = (long) Math.ceil(Double.parseDouble(m.group(1)));
            if (seconds >= 1 && seconds <= 120) {
                return seconds * 1000L;
            }
        }
        return Math.min(4000L * (1L << (attempt - 1)), 60000L);
    }

    private String buildPlanSystemPrompt() {
        return """
                You are a smart academic study planner. You receive a student's upcoming academic events
                (exams, assignments, projects, holidays) and you build a realistic, daily study schedule.

                Return ONLY a JSON object with this exact shape (no markdown):
                {
                  "plan": [
                    {
                      "date": "YYYY-MM-DD",
                      "sessions": [
                        { "start_time": "HH:mm", "subject": "subject name", "hours": 2, "type": "STUDY" }
                      ]
                    }
                  ]
                }

                session types allowed: STUDY, REVISION, PRACTICE, MOCK_TEST, ASSIGNMENT, BREAK.

                Rules:
                - Create a session list for EVERY day in the requested range (no gaps).
                - Distribute the student's subjects across the days. Rotate subjects so each one appears regularly.
                - IMPORTANT: use the REAL subject names that appear in the event list (e.g. "Operating Systems", "DBMS", "Computer Networks", "Software Engineering"). Never invent generic subject names like "Math", "Science" or "History" when the event list provides real subjects.
                - Prioritize working on material relevant to the nearest exams and assignments.
                - Put the hardest/most important subject in the morning block.
                - Keep each session 1-3 hours, 2-5 sessions per day, with realistic breaks and revision sessions.
                - On days with an exam, schedule mostly REVISION and light PRACTICE.
                - On holidays / free days, still plan productive-but-lighter study plus a BREAK session.
                - Never fabricate events; only plan around the given event list.
                """;
    }

    private String buildPlanPrompt(List<AcademicEvent> events, LocalDate today, LocalDate windowEnd) {
        StringBuilder sb = new StringBuilder();
        sb.append("Today is ").append(today).append(". Plan every day from ")
                .append(today).append(" to ").append(windowEnd).append(".\n\n");
        if (events.isEmpty()) {
            sb.append("There are no upcoming academic events in this window. "
                    + "Create a light balanced revision schedule using generic subject names "
                    + "(e.g. 'Subject A', 'Subject B') so the student can fill in their own topics.\n");
        } else {
            sb.append("Upcoming academic events (date | title | category | priority):\n");
            events.stream().limit(80).forEach(e ->
                    sb.append("- ").append(e.getEventDate())
                            .append(" | ").append(e.getTitle())
                            .append(" | ").append(e.getCategory())
                            .append(" | ").append(e.getPriority())
                            .append("\n"));
            if (events.size() > 80) {
                sb.append("(").append(events.size() - 80).append(" more events beyond this window's focus)\n");
            }
            sb.append("\nUse these as the student's real subjects (extract the subject name from each event "
                    + "title, e.g. 'Assignment 1 - Operating Systems' -> 'Operating Systems', "
                    + "'DBMS Lab' -> 'DBMS'):\n");
            events.stream()
                    .map(e -> inferSubject(e.getTitle(), e.getCategory()))
                    .filter(Objects::nonNull)
                    .distinct()
                    .limit(15)
                    .forEach(s -> sb.append("- ").append(s).append("\n"));
        }
        return sb.toString();
    }

    private List<StudyDayDraft> parsePlanJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return List.of();
        }
        String json = raw.substring(start, end + 1);
        try {
            Map<String, Object> root = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, Map.class);
            List<StudyDayDraft> days = new ArrayList<>();
            Object plan = root.get("plan");
            if (plan instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> map) {
                        List<StudySessionDraft> sessions = new ArrayList<>();
                        Object rawSessions = map.get("sessions");
                        if (rawSessions instanceof List<?> sessionList) {
                            for (Object s : sessionList) {
                                if (s instanceof Map<?, ?> sm) {
                                    sessions.add(new StudySessionDraft(
                                            parseTime(stringOrNull(sm.get("start_time"))),
                                            stringOrNull(sm.get("subject")),
                                            numberOrNull(sm.get("hours")),
                                            stringOrNull(sm.get("type"))
                                    ));
                                }
                            }
                        }
                        LocalDate date = parseDate(stringOrNull(map.get("date")));
                        if (date != null && !sessions.isEmpty()) {
                            days.add(new StudyDayDraft(date, sessions));
                        }
                    }
                }
            }
            days.sort(Comparator.comparing(StudyDayDraft::date));
            return days;
        } catch (Exception e) {
            log.warn("Could not parse study plan JSON, returning empty plan: {}", safeMessage(e));
            return List.of();
        }
    }

    private StudyPlanResponse toPlanResponse(LocalDate today, List<StudyDayDraft> drafts, List<StudyPlanItem> saved) {
        Map<LocalDate, List<StudySlotResponse>> byDate = saved.stream()
                .collect(Collectors.groupingBy(StudyPlanItem::getPlanDate,
                        Collectors.mapping(StudySlotResponse::from, Collectors.toList())));
        List<StudyDayResponse> days = drafts.stream()
                .map(d -> new StudyDayResponse(
                        d.date(),
                        labelFor(d.date()),
                        byDate.getOrDefault(d.date(), List.of()).stream().mapToDouble(StudySlotResponse::hours).sum(),
                        byDate.getOrDefault(d.date(), List.of())
                                .stream().sorted(Comparator.comparing(s -> s.startTime() == null ? LocalTime.MIN : s.startTime()))
                                .collect(Collectors.toList())))
                .collect(Collectors.toList());
        return new StudyPlanResponse(today, "Study plan generated for " + saved.size() + " sessions.", days);
    }

    private StudyPlanResponse buildPlanFromItems(LocalDate today, List<StudyPlanItem> items) {
        if (items.isEmpty()) {
            return new StudyPlanResponse(today,
                    "No study plan yet. Upload your academic calendar or tap \"Generate Study Plan\".",
                    List.of());
        }
        Map<LocalDate, List<StudySlotResponse>> byDate = items.stream()
                .collect(Collectors.groupingBy(StudyPlanItem::getPlanDate,
                        Collectors.mapping(StudySlotResponse::from, Collectors.toList())));
        List<StudyDayResponse> days = byDate.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new StudyDayResponse(
                        e.getKey(),
                        labelFor(e.getKey()),
                        e.getValue().stream().mapToDouble(StudySlotResponse::hours).sum(),
                        e.getValue().stream()
                                .sorted(Comparator.comparing(s -> s.startTime() == null ? LocalTime.MIN : s.startTime()))
                                .collect(Collectors.toList())))
                .collect(Collectors.toList());
        return new StudyPlanResponse(today, "Study plan loaded.", days);
    }

    private String labelFor(LocalDate date) {
        LocalDate today = LocalDate.now();
        if (date.equals(today)) return "Today";
        if (date.equals(today.plusDays(1))) return "Tomorrow";
        return date.format(DateTimeFormatter.ofPattern("EEEE, MMM d"));
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim(), DATE_FMT);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        for (DateTimeFormatter fmt : List.of(
                DateTimeFormatter.ofPattern("HH:mm"),
                DateTimeFormatter.ofPattern("H:mm")
        )) {
            try {
                return LocalTime.parse(trimmed, fmt);
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        return null;
    }

    private static String stringOrNull(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        if (s.isEmpty() || s.equalsIgnoreCase("null")) return null;
        return s;
    }

    private static Double numberOrNull(Object value) {
        if (value == null) return null;
        try {
            return Double.valueOf(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private User resolveOwner(String ownerEmail) {
        return userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    private static String safeMessage(Throwable t) {
        return t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
    }

    private record StudyDayDraft(LocalDate date, List<StudySessionDraft> sessions) {
    }

    private record StudySessionDraft(LocalTime startTime, String subject, Double hours, String type) {
    }
}
