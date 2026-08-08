package com.careeros.controller;

import com.careeros.service.ResumeParserService;
import com.careeros.service.ResumeAnalyzerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/resume")
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

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            return ResponseEntity.badRequest().body("{\"error\": \"File exceeds the 5 MB limit for resume analysis.\"}");
        }

        if (!"application/pdf".equals(file.getContentType()) && !isPdfName(file.getOriginalFilename())) {
            return ResponseEntity.badRequest().body("{\"error\": \"Only PDF files are allowed.\"}");
        }

        String extractedText = resumeParserService.extractTextFromPDF(file);
        
        if (extractedText.startsWith("Error")) {
            return ResponseEntity.internalServerError().body("{\"error\": \"" + extractedText + "\"}");
        }

        String analysisJson = resumeAnalyzerService.analyzeResume(extractedText);
        
        return ResponseEntity.ok(analysisJson);
    }

    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;

    private static boolean isPdfName(String filename) {
        return filename != null && filename.toLowerCase().endsWith(".pdf");
    }
}
