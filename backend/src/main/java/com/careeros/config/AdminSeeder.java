package com.careeros.config;

import com.careeros.entity.User;
import com.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${careeros.admin.email:admin@nexora.app}")
    private String adminEmail;

    @Value("${careeros.admin.password:}")
    private String adminPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.findAll().stream().anyMatch(u -> "ADMIN".equalsIgnoreCase(u.getRole()))) {
            return;
        }
        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("careeros.admin.password is not set; skipping default admin creation");
            return;
        }
        User admin = User.builder()
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .role("ADMIN")
                .build();
        userRepository.save(admin);
        log.info("Created default admin account: {}", adminEmail);
    }
}