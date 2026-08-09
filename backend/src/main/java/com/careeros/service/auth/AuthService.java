package com.careeros.service.auth;

import com.careeros.dto.auth.AuthRequestDto;
import com.careeros.dto.auth.AuthResponseDto;
import com.careeros.dto.auth.RegisterRequestDto;
import com.careeros.entity.StudentProfile;
import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.StudentProfileRepository;
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
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
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

        String name = requestDto.getName() == null ? null : requestDto.getName().trim();
        if (name != null && !name.isEmpty() && "STUDENT".equals(requestedRole)) {
            String firstName = name;
            String lastName = null;
            int space = name.indexOf(' ');
            if (space > 0) {
                firstName = name.substring(0, space).trim();
                lastName = name.substring(space + 1).trim();
            }
            studentProfileRepository.save(StudentProfile.builder()
                    .user(user)
                    .firstName(firstName)
                    .lastName(lastName)
                    .build());
        }
    }

    public AuthResponseDto authenticateUser(AuthRequestDto requestDto) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(requestDto.getEmail(), requestDto.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String jwt = jwtUtil.generateToken(userDetails);

        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String name = null;
        if ("STUDENT".equals(user.getRole())) {
            name = studentProfileRepository.findByUserId(user.getId())
                    .filter(p -> p.getFirstName() != null && !p.getFirstName().isEmpty())
                    .map(p -> p.getLastName() == null || p.getLastName().isEmpty()
                            ? p.getFirstName()
                            : p.getFirstName() + " " + p.getLastName())
                    .orElse(null);
        }

        return new AuthResponseDto(jwt, user.getEmail(), user.getRole(), name);
    }
}
