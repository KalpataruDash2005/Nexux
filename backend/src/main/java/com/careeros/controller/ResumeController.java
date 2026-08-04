package com.careeros.controller;

import com.careeros.service.ResumeParserService;
import com.careeros.service.ResumeAnalyzerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/resume")
@CrossOrigin(origins = "*")
public class ResumeController {

    @Autowired
    private ResumeParserService resumeParserService;

    @Autowired
    private ResumeAnalyzerService resumeAnalyzerService;

    @PostMapping("/upload")
    public ResponseEntity<String> uploadResume(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("{\"error\": \"File is empty, please upload a valid PDF.\"}");
        }
        
        if (!"application/pdf".equals(file.getContentType())) {
            return ResponseEntity.badRequest().body("{\"error\": \"Only PDF files are allowed.\"}");
        }

        String extractedText = resumeParserService.extractTextFromPDF(file);
        
        if (extractedText.startsWith("Error")) {
            return ResponseEntity.internalServerError().body("{\"error\": \"" + extractedText + "\"}");
        }

        String analysisJson = resumeAnalyzerService.analyzeResume(extractedText);
        
        return ResponseEntity.ok(analysisJson);
    }
}
