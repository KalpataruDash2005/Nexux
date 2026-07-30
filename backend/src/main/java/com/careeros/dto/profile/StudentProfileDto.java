package com.careeros.dto.profile;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentProfileDto {
    private String id;
    private String firstName;
    private String lastName;
    private String university;
    private String degree;
    private Integer graduationYear;
    private String skills;
    private String resumeUrl;
}
