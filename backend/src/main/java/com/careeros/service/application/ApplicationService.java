package com.careeros.service.application;

import com.careeros.dto.application.ApplicationDto;
import com.careeros.dto.application.ApplicationDetailsDto;
import com.careeros.dto.application.CreateApplicationDto;
import com.careeros.dto.application.UpdateApplicationStatusDto;
import com.careeros.entity.Application;
import com.careeros.entity.Job;
import com.careeros.entity.User;
import com.careeros.entity.StudentProfile;
import com.careeros.repository.ApplicationRepository;
import com.careeros.repository.JobRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.StudentProfileRepository;
import com.careeros.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;

    public ApplicationDto applyForJob(String userEmail, CreateApplicationDto dto) {
        User student = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        if (!student.getRole().equalsIgnoreCase("STUDENT")) {
            throw new AccessDeniedException("Only students can apply for jobs");
        }

        Job job = jobRepository.findById(dto.getJobId())
                .orElseThrow(() -> new BadRequestException("Job not found"));

        if (!job.getStatus().equalsIgnoreCase("ACTIVE")) {
            throw new BadRequestException("Job is not active");
        }

        if (applicationRepository.findByJobIdAndStudentId(job.getId(), student.getId()).isPresent()) {
            throw new BadRequestException("You have already applied for this job");
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
                .orElseThrow(() -> new BadRequestException("User not found"));

        return applicationRepository.findByStudentIdOrderByCreatedAtDesc(student.getId())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public List<ApplicationDetailsDto> getApplicationsForJob(String userEmail, String jobId) {
        User recruiter = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new BadRequestException("Job not found"));

        if (!job.getPostedBy().getId().equals(recruiter.getId()) && !recruiter.getRole().equalsIgnoreCase("ADMIN")) {
            throw new AccessDeniedException("You can only view applications for your own jobs");
        }

        List<Application> applications = applicationRepository.findByJobIdOrderByCreatedAtDesc(jobId);
        List<String> studentIds = applications.stream().map(a -> a.getStudent().getId()).collect(Collectors.toList());
        java.util.Map<String, StudentProfile> profileMap = studentProfileRepository.findByUserIdIn(studentIds)
                .stream().collect(Collectors.toMap(p -> p.getUser().getId(), p -> p));

        return applications.stream()
                .map(a -> mapToDetailsDtoWithProfile(a, profileMap.get(a.getStudent().getId())))
                .collect(Collectors.toList());
    }

    public ApplicationDetailsDto updateApplicationStatus(String userEmail, String applicationId, UpdateApplicationStatusDto dto) {
        User recruiter = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new BadRequestException("Application not found"));

        Job job = application.getJob();

        if (!job.getPostedBy().getId().equals(recruiter.getId()) && !recruiter.getRole().equalsIgnoreCase("ADMIN")) {
            throw new AccessDeniedException("You can only update applications for your own jobs");
        }

        application.setStatus(dto.getStatus());
        return mapToDetailsDto(applicationRepository.save(application));
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

    private ApplicationDetailsDto mapToDetailsDto(Application application) {
        StudentProfile profile = studentProfileRepository.findByUserId(application.getStudent().getId()).orElse(null);
        return mapToDetailsDtoWithProfile(application, profile);
    }

    private ApplicationDetailsDto mapToDetailsDtoWithProfile(Application application, StudentProfile profile) {
        String name = profile != null ? profile.getFirstName() + " " + profile.getLastName() : "Unknown";
        String resume = profile != null ? profile.getResumeUrl() : null;
        String skills = profile != null ? profile.getSkills() : null;

        return ApplicationDetailsDto.builder()
                .id(application.getId())
                .jobId(application.getJob().getId())
                .jobTitle(application.getJob().getTitle())
                .studentId(application.getStudent().getId())
                .studentEmail(application.getStudent().getEmail())
                .studentName(name.trim().isEmpty() ? "Unknown" : name)
                .studentResumeUrl(resume)
                .studentSkills(skills)
                .status(application.getStatus())
                .createdAt(application.getCreatedAt())
                .build();
    }
}
