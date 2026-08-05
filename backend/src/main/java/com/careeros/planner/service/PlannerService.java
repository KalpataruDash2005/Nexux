package com.careeros.planner.service;

import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.planner.PlannerCategories;
import com.careeros.planner.config.PlannerProperties;
import com.careeros.planner.dto.*;
import com.careeros.planner.entity.AcademicEvent;
import com.careeros.planner.entity.StudyPlanItem;
import com.careeros.planner.repository.AcademicEventRepository;
import com.careeros.planner.repository.StudyPlanItemRepository;
import com.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlannerService {

    private final PlannerExtractionService extractionService;
    private final PlannerStudyService studyService;
    private final PlannerProperties plannerProperties;
    private final AcademicEventRepository eventRepository;
    private final StudyPlanItemRepository studyItemRepository;
    private final UserRepository userRepository;

    // ------------------------------------------------------------------
    // Upload + extraction
    // ------------------------------------------------------------------

    @Transactional
    public CalendarUploadResponse uploadCalendar(String ownerEmail, MultipartFile file) {
        User owner = resolveOwner(ownerEmail);
        PlannerExtractionService.ExtractionResult result = extractionService.extract(file);

        List<PlannerEventResponse> savedEvents = new ArrayList<>();
        int duplicates = 0;
        int needsVerification = 0;
        List<String> warnings = new ArrayList<>(result.warnings());

        List<AcademicEvent> existing = eventRepository.findByOwnerIdOrderByEventDateAsc(owner.getId());

        for (PlannerExtractionService.EventDraft draft : result.events()) {
            boolean duplicate = existing.stream().anyMatch(e ->
                    e.getTitle().equalsIgnoreCase(draft.title())
                            && e.getEventDate().equals(draft.date()));
            if (duplicate) {
                duplicates++;
                continue;
            }
            boolean lowConfidence = draft.confidence() != null && draft.confidence() < plannerProperties.getMinConfidence();
            if (lowConfidence) {
                needsVerification++;
            }
            AcademicEvent event = AcademicEvent.builder()
                    .owner(owner)
                    .title(draft.title())
                    .description(draft.description())
                    .eventDate(draft.date())
                    .startTime(draft.startTime())
                    .endTime(draft.endTime())
                    .category(draft.category())
                    .priority(draft.priority())
                    .color(draft.color())
                    .location(draft.location())
                    .semester(draft.semester())
                    .completed(false)
                    .needsVerification(lowConfidence)
                    .aiConfidence(draft.confidence())
                    .sourceFile(result.sourceFileName())
                    .build();
            savedEvents.add(PlannerEventResponse.from(eventRepository.save(event)));
        }

        String message = savedEvents.size() + " event" + (savedEvents.size() == 1 ? "" : "s")
                + " imported from " + (result.sourceFileName() == null ? "your calendar" : result.sourceFileName())
                + (duplicates > 0 ? ", " + duplicates + " duplicate" + (duplicates == 1 ? "" : "s") + " skipped" : "")
                + ".";

        // Automatically refresh the study plan so the dashboard is always up to date.
        try {
            studyService.generateStudyPlan(ownerEmail, null);
        } catch (Exception e) {
            warnings.add("Study plan could not be regenerated automatically: " + safeMessage(e));
        }

        return new CalendarUploadResponse(
                savedEvents.size(),
                duplicates,
                needsVerification,
                result.semesterStart(),
                result.semesterEnd(),
                warnings,
                savedEvents,
                message
        );
    }

    @Transactional
    public void clearAll(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        eventRepository.deleteByOwnerId(owner.getId());
        studyItemRepository.deleteByOwnerId(owner.getId());
        log.info("Cleared all planner data for {}", ownerEmail);
    }

    // ------------------------------------------------------------------
    // Read
    // ------------------------------------------------------------------

    public List<PlannerEventResponse> getEvents(String ownerEmail, String category, String status, String q) {
        User owner = resolveOwner(ownerEmail);
        List<AcademicEvent> events = eventRepository.findByOwnerIdOrderByEventDateAsc(owner.getId());

        List<AcademicEvent> filtered = events;
        if (category != null && !category.isBlank()) {
            String normalized = PlannerCategories.normalize(category);
            filtered = filtered.stream()
                    .filter(e -> e.getCategory().equals(normalized))
                    .collect(Collectors.toList());
        }
        if (status != null && !status.isBlank()) {
            String s = status.toUpperCase();
            if (s.equals("UPCOMING")) {
                filtered = filtered.stream()
                        .filter(e -> !e.isCompleted() && !e.getEventDate().isBefore(LocalDate.now()))
                        .collect(Collectors.toList());
            } else if (s.equals("COMPLETED")) {
                filtered = filtered.stream()
                        .filter(AcademicEvent::isCompleted)
                        .collect(Collectors.toList());
            } else if (s.equals("PENDING_VERIFICATION")) {
                filtered = filtered.stream()
                        .filter(AcademicEvent::isNeedsVerification)
                        .collect(Collectors.toList());
            }
        }
        if (q != null && !q.isBlank()) {
            String query = q.toLowerCase(Locale.ROOT);
            filtered = filtered.stream()
                    .filter(e -> e.getTitle().toLowerCase(Locale.ROOT).contains(query)
                            || (e.getDescription() != null && e.getDescription().toLowerCase(Locale.ROOT).contains(query))
                            || (e.getLocation() != null && e.getLocation().toLowerCase(Locale.ROOT).contains(query))
                            || (e.getSemester() != null && e.getSemester().toLowerCase(Locale.ROOT).contains(query)))
                    .collect(Collectors.toList());
        }

        return filtered.stream().map(PlannerEventResponse::from).collect(Collectors.toList());
    }

    public List<PlannerEventResponse> getUpcoming(String ownerEmail, String range) {
        User owner = resolveOwner(ownerEmail);
        LocalDate today = LocalDate.now();
        List<AcademicEvent> events;
        if (range == null) {
            events = eventRepository.findByOwnerIdAndEventDateGreaterThanEqualOrderByEventDateAsc(
                    owner.getId(), today);
        } else {
            String r = range.toUpperCase();
            LocalDate from = today;
            LocalDate to = switch (r) {
                case "TODAY" -> today;
                case "TOMORROW" -> today.plusDays(1);
                case "WEEK" -> today.plusDays(7);
                case "NEXT_WEEK" -> today.plusDays(14);
                default -> today.plusDays(30);
            };
            if (r.equals("NEXT_WEEK")) {
                from = today.plusDays(8);
            }
            events = eventRepository
                    .findByOwnerIdAndEventDateGreaterThanEqualAndEventDateLessThanEqualOrderByEventDateAsc(
                            owner.getId(), from, to);
        }
        return events.stream()
                .filter(e -> !e.isCompleted() || e.getEventDate().isBefore(today))
                .sorted(Comparator.comparing(AcademicEvent::getEventDate))
                .limit(50)
                .map(PlannerEventResponse::from)
                .collect(Collectors.toList());
    }

    public PlannerEventResponse getEvent(String ownerEmail, String id) {
        return PlannerEventResponse.from(resolveEvent(ownerEmail, id));
    }

    // ------------------------------------------------------------------
    // Write
    // ------------------------------------------------------------------

    @Transactional
    public PlannerEventResponse updateEvent(String ownerEmail, String id, UpdateEventRequest request) {
        AcademicEvent event = resolveEvent(ownerEmail, id);
        if (request.title() != null && !request.title().isBlank()) {
            event.setTitle(request.title().trim());
        }
        if (request.description() != null) {
            event.setDescription(request.description().trim());
        }
        if (request.date() != null) {
            event.setEventDate(request.date());
        }
        if (request.startTime() != null) {
            event.setStartTime(request.startTime());
        }
        if (request.endTime() != null) {
            event.setEndTime(request.endTime());
        }
        if (request.category() != null && !request.category().isBlank()) {
            event.setCategory(PlannerCategories.normalize(request.category()));
            if (event.getColor() == null) {
                event.setColor(AcademicEvent.defaultColor(event.getCategory()));
            }
        }
        if (request.priority() != null && !request.priority().isBlank()) {
            event.setPriority(request.priority().trim().toUpperCase());
        }
        if (request.color() != null && !request.color().isBlank()) {
            event.setColor(request.color().trim());
        }
        if (request.location() != null) {
            event.setLocation(request.location().trim().isEmpty() ? null : request.location().trim());
        }
        if (request.semester() != null) {
            event.setSemester(request.semester().trim().isEmpty() ? null : request.semester().trim());
        }
        if (request.completed() != null) {
            event.setCompleted(request.completed());
        }
        if (request.needsVerification() != null) {
            event.setNeedsVerification(request.needsVerification());
            if (Boolean.FALSE.equals(request.needsVerification()) && event.getAiConfidence() != null
                    && event.getAiConfidence() < plannerProperties.getMinConfidence()) {
                event.setAiConfidence(Math.max(event.getAiConfidence(), plannerProperties.getMinConfidence()));
            }
        }
        return PlannerEventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public void deleteEvent(String ownerEmail, String id) {
        AcademicEvent event = resolveEvent(ownerEmail, id);
        eventRepository.delete(event);
    }

    // ------------------------------------------------------------------
    // Stats / progress
    // ------------------------------------------------------------------

    public PlannerStatsResponse getStats(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        List<AcademicEvent> events = eventRepository.findByOwnerIdOrderByEventDateAsc(owner.getId());

        long upcoming = events.stream()
                .filter(e -> !e.isCompleted() && !e.getEventDate().isBefore(LocalDate.now()))
                .count();
        long completed = events.stream().filter(AcademicEvent::isCompleted).count();
        long needsVerification = events.stream().filter(AcademicEvent::isNeedsVerification).count();

        Map<String, Long> byCategory = events.stream()
                .collect(Collectors.groupingBy(AcademicEvent::getCategory, Collectors.counting()));

        List<SubjectProgress> progress = buildStudyProgress(owner.getId());

        return new PlannerStatsResponse(events.size(), upcoming, completed, needsVerification, byCategory, progress);
    }

    private List<SubjectProgress> buildStudyProgress(String ownerId) {
        LocalDate today = LocalDate.now();
        LocalDate windowStart = today.minusDays(7);
        List<StudyPlanItem> items = studyItemRepository.findByOwnerIdAndPlanDateLessThanEqual(ownerId, today)
                .stream()
                .filter(i -> !i.getPlanDate().isBefore(windowStart))
                .collect(Collectors.toList());

        Map<String, double[]> bySubject = new LinkedHashMap<>();
        for (StudyPlanItem item : items) {
            double[] acc = bySubject.computeIfAbsent(item.getSubject(), k -> new double[2]);
            acc[0] += item.getHours() == null ? 1.0 : item.getHours();
            if (item.isCompleted()) {
                acc[1] += item.getHours() == null ? 1.0 : item.getHours();
            }
        }
        return bySubject.entrySet().stream()
                .map(e -> {
                    double planned = e.getValue()[0];
                    double done = e.getValue()[1];
                    int percent = planned <= 0 ? 0 : (int) Math.round(done / planned * 100);
                    return new SubjectProgress(e.getKey(), planned, done, percent);
                })
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User resolveOwner(String ownerEmail) {
        return userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    private AcademicEvent resolveEvent(String ownerEmail, String id) {
        User owner = resolveOwner(ownerEmail);
        return eventRepository.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new BadRequestException("Event not found or access denied"));
    }

    private static String safeMessage(Throwable t) {
        return t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
    }
}
