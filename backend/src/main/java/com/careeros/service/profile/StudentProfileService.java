package com.careeros.service.profile;

import com.careeros.dto.profile.StudentProfileDto;
import com.careeros.entity.StudentProfile;
import com.careeros.entity.User;
import com.careeros.repository.StudentProfileRepository;
import com.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StudentProfileService {

    private final StudentProfileRepository profileRepository;
    private final UserRepository userRepository;

    public StudentProfileDto getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        StudentProfile profile = profileRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    StudentProfile newProfile = StudentProfile.builder().user(user).build();
                    return profileRepository.save(newProfile);
                });

        return mapToDto(profile);
    }

    public StudentProfileDto updateProfile(String email, StudentProfileDto dto) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        StudentProfile profile = profileRepository.findByUserId(user.getId())
                .orElseGet(() -> StudentProfile.builder().user(user).build());

        profile.setFirstName(dto.getFirstName());
        profile.setLastName(dto.getLastName());
        profile.setUniversity(dto.getUniversity());
        profile.setDegree(dto.getDegree());
        profile.setGraduationYear(dto.getGraduationYear());
        profile.setSkills(dto.getSkills());
        profile.setResumeUrl(dto.getResumeUrl());

        StudentProfile updatedProfile = profileRepository.save(profile);
        return mapToDto(updatedProfile);
    }

    private StudentProfileDto mapToDto(StudentProfile profile) {
        return StudentProfileDto.builder()
                .id(profile.getId())
                .firstName(profile.getFirstName())
                .lastName(profile.getLastName())
                .university(profile.getUniversity())
                .degree(profile.getDegree())
                .graduationYear(profile.getGraduationYear())
                .skills(profile.getSkills())
                .resumeUrl(profile.getResumeUrl())
                .build();
    }
}
