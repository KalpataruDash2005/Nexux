package com.careeros.placement.dto;

import java.util.List;
import java.util.Map;

public record AnalyzeResumeResponse(
        String resumeId,
        String fileName,
        int textLength,
        Analysis analysis
) {
    public record Analysis(
            String candidateName,
            int atsScore,
            int overallScore,
            Map<String, Integer> categoryScores,
            List<String> skills,
            List<String> missingSkills,
            List<String> strengths,
            List<String> weaknesses,
            List<Suggestion> suggestions,
            List<Bullet> rewrittenBullets,
            List<String> sections,
            List<Project> projects,
            List<Education> education,
            List<Experience> experience,
            List<String> expectedQuestions,
            List<String> recommendedProjects,
            List<String> recommendedCertifications,
            List<String> checklist
    ) {}

    public record Suggestion(String line, String suggestion) {}

    public record Bullet(String original, String rewritten) {}

    public record Project(String title, String description, List<String> technologies, List<String> highlights) {}

    public record Education(String degree, String institution, String duration, String percentage) {}

    public record Experience(String company, String role, String duration, List<String> highlights) {}
}
