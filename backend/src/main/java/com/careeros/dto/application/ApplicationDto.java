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
public class ApplicationDto {
    private String id;
    private String jobId;
    private String jobTitle;
    private String companyName;
    private String studentId;
    private String studentEmail;
    private String status;
    private LocalDateTime createdAt;
}
