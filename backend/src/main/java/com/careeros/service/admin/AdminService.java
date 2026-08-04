package com.careeros.service.admin;

import com.careeros.dto.job.JobDto;
import com.careeros.dto.user.UserAdminDto;
import com.careeros.entity.Job;
import com.careeros.entity.User;
import com.careeros.repository.JobRepository;
import com.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final JobRepository jobRepository;

    public List<UserAdminDto> getAllUsers(String adminEmail) {
        verifyAdmin(adminEmail);
        return userRepository.findAll().stream()
                .map(this::mapUserToDto)
                .collect(Collectors.toList());
    }

    public List<JobDto> getAllJobs(String adminEmail) {
        verifyAdmin(adminEmail);
        return jobRepository.findAll().stream()
                .map(this::mapJobToDto)
                .collect(Collectors.toList());
    }

    private void verifyAdmin(String email) {
        User admin = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!admin.getRole().equalsIgnoreCase("ADMIN")) {
            throw new AccessDeniedException("Unauthorized: Requires ADMIN role");
        }
    }

    private UserAdminDto mapUserToDto(User user) {
        return UserAdminDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }

    private JobDto mapJobToDto(Job job) {
        return JobDto.builder()
                .id(job.getId())
                .title(job.getTitle())
                .companyName(job.getCompanyName())
                .description(job.getDescription())
                .location(job.getLocation())
                .salary(job.getSalary())
                .status(job.getStatus())
                .postedByEmail(job.getPostedBy().getEmail())
                .createdAt(job.getCreatedAt())
                .build();
    }
}
