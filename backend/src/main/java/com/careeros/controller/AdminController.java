package com.careeros.controller;

import com.careeros.dto.job.JobDto;
import com.careeros.dto.user.UserAdminDto;
import com.careeros.service.admin.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    public ResponseEntity<List<UserAdminDto>> getAllUsers(Authentication authentication) {
        return ResponseEntity.ok(adminService.getAllUsers(authentication.getName()));
    }

    @GetMapping("/jobs")
    public ResponseEntity<List<JobDto>> getAllJobs(Authentication authentication) {
        return ResponseEntity.ok(adminService.getAllJobs(authentication.getName()));
    }
}
