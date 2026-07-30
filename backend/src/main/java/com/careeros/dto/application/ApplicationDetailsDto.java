package com.careeros.dto.application;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationDetailsDto {
    private String id;
    private String jobId;
    private String jobTitle;
    private String studentId;
    private String studentEmail;
    private String studentName;
    private String studentResumeUrl;
    private String studentSkills;
    private String status;
    private LocalDateTime createdAt;
}
