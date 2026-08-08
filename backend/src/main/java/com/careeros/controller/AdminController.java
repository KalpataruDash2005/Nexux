package com.careeros.controller;

import com.careeros.dto.admin.FeedbackAdminDto;
import com.careeros.dto.job.JobDto;
import com.careeros.dto.user.UserAdminDto;
import com.careeros.service.admin.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

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

    @GetMapping("/feedback")
    public ResponseEntity<List<FeedbackAdminDto>> getAllFeedback(Authentication authentication) {
        return ResponseEntity.ok(adminService.getAllFeedback(authentication.getName()));
    }

    @PatchMapping("/feedback/{id}/status")
    public ResponseEntity<Void> updateFeedbackStatus(Authentication authentication,
                                                     @PathVariable String id,
                                                     @RequestBody Map<String, String> body) {
        adminService.updateFeedbackStatus(authentication.getName(), id, body.get("status"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/feedback/{id}")
    public ResponseEntity<Void> deleteFeedback(Authentication authentication, @PathVariable String id) {
        adminService.deleteFeedback(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
