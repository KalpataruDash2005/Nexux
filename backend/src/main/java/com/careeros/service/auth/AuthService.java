package com.careeros.service.auth;

import com.careeros.dto.auth.AuthRequestDto;
import com.careeros.dto.auth.AuthResponseDto;
import com.careeros.dto.auth.RegisterRequestDto;
import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.UserRepository;
import com.careeros.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public void registerUser(RegisterRequestDto requestDto) {
        if (userRepository.existsByEmail(requestDto.getEmail())) {
            throw new BadRequestException("Email is already in use!");
        }

        String requestedRole = requestDto.getRole() != null ? requestDto.getRole().toUpperCase() : "STUDENT";
        if (!Set.of("STUDENT", "RECRUITER").contains(requestedRole)) {
            throw new BadRequestException("Role must be STUDENT or RECRUITER");
        }

        User user = User.builder()
                .email(requestDto.getEmail())
                .passwordHash(passwordEncoder.encode(requestDto.getPassword()))
                .role(requestedRole)
                .build();

        userRepository.save(user);
    }

    public AuthResponseDto authenticateUser(AuthRequestDto requestDto) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(requestDto.getEmail(), requestDto.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String jwt = jwtUtil.generateToken(userDetails);

        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return new AuthResponseDto(jwt, user.getEmail(), user.getRole());
    }
}
