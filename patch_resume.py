import sys

path = r'D:\Coading World\Nexux\backend\src\main\java\com\careeros\service\ResumeAnalyzerService.java'
content = '''package com.careeros.service;

import com.careeros.ai.AIService;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ResumeAnalyzerService {

    private final AIService aiService;

    public String analyzeResume(String resumeText) {
        String prompt = "You are an expert technical recruiter and resume analyzer. " +
                "I will provide you with the text extracted from a resume. " +
                "Please analyze it and provide a structured JSON response (do not use markdown formatting, just plain JSON) with the following keys: " +
                "1. 'candidate_name': Name of the candidate.\\n" +
                "2. 'skills': A list of key skills found.\\n" +
                "3. 'experience_summary': A brief summary of their experience.\\n" +
                "4. 'strengths': Top 3 strengths.\\n" +
                "5. 'weaknesses': Areas of improvement based on the resume.\\n" +
                "6. 'ats_score': An estimated ATS score out of 100 based on standard formatting and keyword richness.\\n\\n" +
                "Resume Text:\\n" + resumeText.replace("\\\"", "\\\\\\\"").replace("\\n", "\\\\n");

        try {
            return aiService.generate("You output plain JSON containing the resume analysis.", prompt, 0.7, 2048, true);
        } catch (Exception e) {
            return "{\\"error\\": \\"Error communicating with AI API: " + e.getMessage() + "\\"}";
        }
    }
}
'''
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
