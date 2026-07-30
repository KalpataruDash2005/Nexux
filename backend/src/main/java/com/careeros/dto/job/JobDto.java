package com.careeros.dto.job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobDto {
    private String id;
    private String title;
    private String companyName;
    private String description;
    private String location;
    private String salary;
    private String status;
    private String postedByEmail;
    private LocalDateTime createdAt;
}
