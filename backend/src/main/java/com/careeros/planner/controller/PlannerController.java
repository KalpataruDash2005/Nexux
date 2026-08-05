package com.careeros.planner.controller;

import com.careeros.planner.dto.*;
import com.careeros.planner.service.PlannerService;
import com.careeros.planner.service.PlannerStudyService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/planner")
@RequiredArgsConstructor
public class PlannerController {

    private final PlannerService plannerService;
    private final PlannerStudyService studyService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    // ------------------------------------------------------------------
    // Upload / extraction
    // ------------------------------------------------------------------

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<CalendarUploadResponse> uploadCalendar(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(plannerService.uploadCalendar(getCurrentUserEmail(), file));
    }

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    @GetMapping("/events")
    public ResponseEntity<List<PlannerEventResponse>> getEvents(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(plannerService.getEvents(getCurrentUserEmail(), category, status, q));
    }

    @GetMapping("/events/{id}")
    public ResponseEntity<PlannerEventResponse> getEvent(@PathVariable String id) {
        return ResponseEntity.ok(plannerService.getEvent(getCurrentUserEmail(), id));
    }

    @PatchMapping("/events/{id}")
    public ResponseEntity<PlannerEventResponse> updateEvent(@PathVariable String id,
                                                            @RequestBody UpdateEventRequest request) {
        return ResponseEntity.ok(plannerService.updateEvent(getCurrentUserEmail(), id, request));
    }

    @DeleteMapping("/events/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable String id) {
        plannerService.deleteEvent(getCurrentUserEmail(), id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/clear")
    public ResponseEntity<Void> clearAll() {
        plannerService.clearAll(getCurrentUserEmail());
        return ResponseEntity.ok().build();
    }

    // ------------------------------------------------------------------
    // Dashboard widgets
    // ------------------------------------------------------------------

    @GetMapping("/today")
    public ResponseEntity<TodayFocusResponse> getTodayFocus() {
        return ResponseEntity.ok(studyService.getTodayFocus(getCurrentUserEmail()));
    }

    @GetMapping("/upcoming")
    public ResponseEntity<List<PlannerEventResponse>> getUpcoming(
            @RequestParam(required = false) String range) {
        return ResponseEntity.ok(plannerService.getUpcoming(getCurrentUserEmail(), range));
    }

    @GetMapping("/stats")
    public ResponseEntity<PlannerStatsResponse> getStats() {
        return ResponseEntity.ok(plannerService.getStats(getCurrentUserEmail()));
    }

    // ------------------------------------------------------------------
    // Study plan & schedule
    // ------------------------------------------------------------------

    @GetMapping("/study-plan")
    public ResponseEntity<StudyPlanResponse> getStudyPlan() {
        return ResponseEntity.ok(studyService.getStudyPlan(getCurrentUserEmail()));
    }

    @PostMapping("/study-plan/generate")
    public ResponseEntity<StudyPlanResponse> generateStudyPlan(@RequestBody(required = false) RegeneratePlanRequest request) {
        Integer days = request == null ? null : request.days();
        return ResponseEntity.ok(studyService.generateStudyPlan(getCurrentUserEmail(), days));
    }

    @PostMapping("/regenerate")
    public ResponseEntity<StudyPlanResponse> regenerate(@RequestBody(required = false) RegeneratePlanRequest request) {
        Integer days = request == null ? null : request.days();
        return ResponseEntity.ok(studyService.generateStudyPlan(getCurrentUserEmail(), days));
    }

    @GetMapping("/schedule")
    public ResponseEntity<DailyScheduleResponse> getSchedule(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(studyService.getSchedule(getCurrentUserEmail(), date));
    }

    @PatchMapping("/schedule/sessions/{sessionId}")
    public ResponseEntity<StudySlotResponse> markSessionCompleted(
            @PathVariable String sessionId,
            @RequestParam boolean completed) {
        return ResponseEntity.ok(StudySlotResponse.from(
                studyService.markSessionCompleted(getCurrentUserEmail(), sessionId, completed)));
    }
}
