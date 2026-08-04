package com.careeros.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class ResumeAnalyzerService {

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    public String analyzeResume(String resumeText) {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
        
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String prompt = "You are an expert technical recruiter and resume analyzer. " +
                "I will provide you with the text extracted from a resume. " +
                "Please analyze it and provide a structured JSON response (do not use markdown formatting, just plain JSON) with the following keys: " +
                "1. 'candidate_name': Name of the candidate.\\n" +
                "2. 'skills': A list of key skills found.\\n" +
                "3. 'experience_summary': A brief summary of their experience.\\n" +
                "4. 'strengths': Top 3 strengths.\\n" +
                "5. 'weaknesses': Areas of improvement based on the resume.\\n" +
                "6. 'ats_score': An estimated ATS score out of 100 based on standard formatting and keyword richness.\\n\\n" +
                "Resume Text:\\n" + resumeText.replace("\"", "\\\"").replace("\n", "\\n");

        // Construct Gemini JSON payload
        Map<String, Object> body = Map.of(
            "contents", List.of(
                Map.of("parts", List.of(
                    Map.of("text", prompt)
                ))
            ),
            "generationConfig", Map.of(
                "temperature", 0.7,
                "responseMimeType", "application/json"
            )
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            Map<String, Object> responseBody = response.getBody();
            if (responseBody != null && responseBody.containsKey("candidates")) {
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) responseBody.get("candidates");
                if (!candidates.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
                    if (!parts.isEmpty()) {
                        return (String) parts.get(0).get("text");
                    }
                }
            }
            return "{\"error\": \"Failed to parse response from Gemini\"}";
        } catch (Exception e) {
            return "{\"error\": \"Error communicating with Gemini API: " + e.getMessage() + "\"}";
        }
    }
}
