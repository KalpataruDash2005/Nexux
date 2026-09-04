package com.careeros.service;

import com.careeros.ai.AIService;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ResumeAnalyzerService {

    private final AIService aiService;

    public String analyzeResume(String resumeText) {
        String prompt = "Resume:\n" + resumeText.replace("\"", "\\\"").replace("\n", "\\n");

        try {
            return aiService.generate(com.careeros.ai.AITask.RESUME_ANALYSIS, "You are a resume analyzer.", prompt, 0.7, 2048, true);
        } catch (Exception e) {
            return "{\"error\": \"Error communicating with AI API: " + e.getMessage() + "\"}";
        }
    }
}
