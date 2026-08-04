package com.careeros.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;

@Service
public class ResumeParserService {

    public String extractTextFromPDF(MultipartFile file) {
        // try-with-resources to prevent memory leaks
        try (InputStream inputStream = file.getInputStream();
             PDDocument document = PDDocument.load(inputStream)) {
            
            // PDFTextStripper extracts plain text from the PDF
            PDFTextStripper textStripper = new PDFTextStripper();
            return textStripper.getText(document);
            
        } catch (Exception e) {
            return "Error extracting text: " + e.getMessage();
        }
    }
}
