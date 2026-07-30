package com.careeros.controller;

import com.careeros.dto.auth.AuthRequestDto;
import com.careeros.dto.auth.AuthResponseDto;
import com.careeros.dto.auth.RegisterRequestDto;
import com.careeros.service.auth.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@Valid @RequestBody RegisterRequestDto requestDto) {
        authService.registerUser(requestDto);
        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponseDto> authenticateUser(@Valid @RequestBody AuthRequestDto requestDto) {
        AuthResponseDto responseDto = authService.authenticateUser(requestDto);
        return ResponseEntity.ok(responseDto);
    }
}
