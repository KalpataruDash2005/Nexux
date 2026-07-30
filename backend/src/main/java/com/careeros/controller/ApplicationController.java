package com.careeros.controller;

import com.careeros.dto.application.ApplicationDto;
import com.careeros.dto.application.ApplicationDetailsDto;
import com.careeros.dto.application.CreateApplicationDto;
import com.careeros.dto.application.UpdateApplicationStatusDto;
import com.careeros.service.application.ApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;

    @GetMapping("/me")
    public ResponseEntity<List<ApplicationDto>> getMyApplications(Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(applicationService.getMyApplications(email));
    }

    @PostMapping
    public ResponseEntity<ApplicationDto> applyForJob(
            Authentication authentication,
            @RequestBody CreateApplicationDto dto) {
        String email = authentication.getName();
        return ResponseEntity.ok(applicationService.applyForJob(email, dto));
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<List<ApplicationDetailsDto>> getApplicationsForJob(
            Authentication authentication,
            @PathVariable String jobId) {
        String email = authentication.getName();
        return ResponseEntity.ok(applicationService.getApplicationsForJob(email, jobId));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApplicationDetailsDto> updateApplicationStatus(
            Authentication authentication,
            @PathVariable String id,
            @RequestBody UpdateApplicationStatusDto dto) {
        String email = authentication.getName();
        return ResponseEntity.ok(applicationService.updateApplicationStatus(email, id, dto));
    }
}
