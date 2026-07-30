package com.careeros.service.job;

import com.careeros.dto.job.JobDto;
import com.careeros.entity.Job;
import com.careeros.entity.User;
import com.careeros.repository.JobRepository;
import com.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final UserRepository userRepository;

    public List<JobDto> getAllActiveJobs() {
        return jobRepository.findByStatusOrderByCreatedAtDesc("ACTIVE")
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public JobDto createJob(String userEmail, JobDto dto) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.getRole().equalsIgnoreCase("RECRUITER") && !user.getRole().equalsIgnoreCase("ADMIN")) {
            throw new RuntimeException("Only recruiters or admins can post jobs");
        }

        Job job = Job.builder()
                .postedBy(user)
                .title(dto.getTitle())
                .companyName(dto.getCompanyName())
                .description(dto.getDescription())
                .location(dto.getLocation())
                .salary(dto.getSalary())
                .status("ACTIVE")
                .build();

        return mapToDto(jobRepository.save(job));
    }

    private JobDto mapToDto(Job job) {
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
