package com.careeros.placement.controller;

import com.careeros.placement.dto.*;
import com.careeros.placement.service.PlacementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/placement")
@RequiredArgsConstructor
public class PlacementController {

    private final PlacementService placementService;

    private String getCurrentUserEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    // ------------------------------------------------------------------
    // Resume
    // ------------------------------------------------------------------

    @PostMapping(value = "/resume/analyze", consumes = "multipart/form-data")
    public ResponseEntity<AnalyzeResumeResponse> analyzeResume(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(placementService.analyzeResume(getCurrentUserEmail(), file));
    }

    @GetMapping("/resume/latest")
    public ResponseEntity<LatestResumeResponse> getLatestResume() {
        return ResponseEntity.ok(placementService.getLatestResume(getCurrentUserEmail()));
    }

    @GetMapping("/resumes")
    public ResponseEntity<List<ResumeListItem>> getResumes() {
        return ResponseEntity.ok(placementService.getResumes(getCurrentUserEmail()));
    }

    // ------------------------------------------------------------------
    // Dashboard / Analytics / Readiness / Roadmap
    // ------------------------------------------------------------------

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardResponse> getDashboard() {
        return ResponseEntity.ok(placementService.getDashboard(getCurrentUserEmail()));
    }

    @GetMapping("/analytics")
    public ResponseEntity<AnalyticsResponse> getAnalytics() {
        return ResponseEntity.ok(placementService.getAnalytics(getCurrentUserEmail()));
    }

    @GetMapping("/readiness")
    public ResponseEntity<ReadinessResponse> getReadiness() {
        return ResponseEntity.ok(placementService.getReadiness(getCurrentUserEmail()));
    }

    @GetMapping("/roadmap")
    public ResponseEntity<RoadmapResponse> getRoadmap() {
        return ResponseEntity.ok(placementService.getRoadmap(getCurrentUserEmail()));
    }

    // ------------------------------------------------------------------
    // Sessions
    // ------------------------------------------------------------------

    @PostMapping("/sessions")
    public ResponseEntity<PlacementSessionDto> createSession(@RequestBody CreateSessionRequest request) {
        return ResponseEntity.ok(placementService.createSession(getCurrentUserEmail(), request));
    }

    @DeleteMapping("/reset")
    public ResponseEntity<PlacementResetResponse> resetPlacement() {
        return ResponseEntity.ok(placementService.resetAll(getCurrentUserEmail()));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<PlacementSessionDto>> getSessions() {
        return ResponseEntity.ok(placementService.getSessions(getCurrentUserEmail()));
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<SessionDetailResponse> getSession(@PathVariable String id) {
        return ResponseEntity.ok(placementService.getSessionDetail(getCurrentUserEmail(), id));
    }

    @PostMapping("/sessions/{id}/start")
    public ResponseEntity<StartSessionResponse> startSession(@PathVariable String id) {
        return ResponseEntity.ok(placementService.startSession(getCurrentUserEmail(), id));
    }

    @PostMapping("/sessions/{id}/messages")
    public ResponseEntity<SendMessageResponse> sendMessage(@PathVariable String id,
                                                           @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(placementService.sendMessage(getCurrentUserEmail(), id, request.content()));
    }

    @PostMapping("/sessions/{id}/end")
    public ResponseEntity<EndSessionResponse> endSession(@PathVariable String id) {
        return ResponseEntity.ok(placementService.endSession(getCurrentUserEmail(), id));
    }

    // ------------------------------------------------------------------
    // Coding
    // ------------------------------------------------------------------

    @PostMapping("/coding")
    public ResponseEntity<CreateCodingResponse> createCodingSession(@RequestBody CreateCodingRequest request) {
        return ResponseEntity.ok(placementService.createCodingSession(getCurrentUserEmail(), request));
    }

    @PostMapping("/coding/{id}/submit")
    public ResponseEntity<SubmitCodingResponse> submitCoding(@PathVariable String id,
                                                             @RequestBody SubmitCodingRequest request) {
        return ResponseEntity.ok(placementService.submitCoding(getCurrentUserEmail(), id, request));
    }

    // ------------------------------------------------------------------
    // Aptitude
    // ------------------------------------------------------------------

    @PostMapping("/aptitude")
    public ResponseEntity<CreateAptitudeResponse> createAptitudeTest(@RequestBody CreateAptitudeRequest request) {
        return ResponseEntity.ok(placementService.createAptitudeTest(getCurrentUserEmail(), request));
    }

    @PostMapping("/aptitude/{id}/submit")
    public ResponseEntity<SubmitAptitudeResponse> submitAptitude(@PathVariable String id,
                                                                 @RequestBody SubmitAptitudeRequest request) {
        return ResponseEntity.ok(placementService.submitAptitude(getCurrentUserEmail(), id, request));
    }
}
