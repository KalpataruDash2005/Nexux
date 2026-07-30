package com.careeros.controller;

import com.careeros.dto.profile.StudentProfileDto;
import com.careeros.service.profile.StudentProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/students")
@RequiredArgsConstructor
public class StudentProfileController {

    private final StudentProfileService profileService;

    @GetMapping("/me")
    public ResponseEntity<StudentProfileDto> getMyProfile(Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(profileService.getProfile(email));
    }

    @PutMapping("/me")
    public ResponseEntity<StudentProfileDto> updateMyProfile(
            Authentication authentication,
            @RequestBody StudentProfileDto profileDto) {
        String email = authentication.getName();
        return ResponseEntity.ok(profileService.updateProfile(email, profileDto));
    }
}
