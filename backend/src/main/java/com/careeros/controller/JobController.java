package com.careeros.controller;

import com.careeros.dto.job.JobDto;
import com.careeros.service.job.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @GetMapping
    public ResponseEntity<List<JobDto>> getActiveJobs() {
        return ResponseEntity.ok(jobService.getAllActiveJobs());
    }

    @PostMapping
    public ResponseEntity<JobDto> createJob(Authentication authentication, @RequestBody JobDto jobDto) {
        String email = authentication.getName();
        return ResponseEntity.ok(jobService.createJob(email, jobDto));
    }
}
