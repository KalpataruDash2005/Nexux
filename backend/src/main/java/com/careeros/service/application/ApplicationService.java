package com.careeros.service.application;

import com.careeros.dto.application.ApplicationDto;
import com.careeros.dto.application.CreateApplicationDto;
import com.careeros.entity.Application;
import com.careeros.entity.Job;
import com.careeros.entity.User;
import com.careeros.repository.ApplicationRepository;
import com.careeros.repository.JobRepository;
import com.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;

    public ApplicationDto applyForJob(String userEmail, CreateApplicationDto dto) {
        User student = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!student.getRole().equalsIgnoreCase("STUDENT")) {
            throw new RuntimeException("Only students can apply for jobs");
        }

        Job job = jobRepository.findById(dto.getJobId())
                .orElseThrow(() -> new RuntimeException("Job not found"));

        if (!job.getStatus().equalsIgnoreCase("ACTIVE")) {
            throw new RuntimeException("Job is not active");
        }

        if (applicationRepository.findByJobIdAndStudentId(job.getId(), student.getId()).isPresent()) {
            throw new RuntimeException("You have already applied for this job");
        }

        Application application = Application.builder()
                .job(job)
                .student(student)
                .status("APPLIED")
                .build();

        return mapToDto(applicationRepository.save(application));
    }

    public List<ApplicationDto> getMyApplications(String userEmail) {
        User student = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return applicationRepository.findByStudentIdOrderByCreatedAtDesc(student.getId())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private ApplicationDto mapToDto(Application application) {
        return ApplicationDto.builder()
                .id(application.getId())
                .jobId(application.getJob().getId())
                .jobTitle(application.getJob().getTitle())
                .companyName(application.getJob().getCompanyName())
                .studentId(application.getStudent().getId())
                .studentEmail(application.getStudent().getEmail())
                .status(application.getStatus())
                .createdAt(application.getCreatedAt())
                .build();
    }
}
