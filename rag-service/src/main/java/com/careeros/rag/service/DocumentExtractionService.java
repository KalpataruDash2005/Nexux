package com.careeros.rag.service;

import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.parser.apache.pdfbox.ApachePdfBoxDocumentParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Service
public class DocumentExtractionService {

    private static final Logger log = LoggerFactory.getLogger(DocumentExtractionService.class);

    public String extractText(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File must not be empty");
        }

        String fileName = file.getOriginalFilename();
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("File name must not be null or empty");
        }

        log.info("Extracting text from file: {} (Size: {} bytes)", fileName, file.getSize());

        String lowerName = fileName.toLowerCase();
        try (InputStream inputStream = file.getInputStream()) {
            if (lowerName.endsWith(".txt")) {
                String text = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
                log.info("Successfully extracted {} characters from TXT file {}", text.length(), fileName);
                return text;
            } else if (lowerName.endsWith(".pdf")) {
                ApachePdfBoxDocumentParser parser = new ApachePdfBoxDocumentParser();
                Document document = parser.parse(inputStream);
                String text = document.text();
                log.info("Successfully extracted {} characters from PDF file {}", text.length(), fileName);
                return text;
            } else {
                throw new IllegalArgumentException("Unsupported file type: " + fileName + ". Only .txt and .pdf are supported.");
            }
        } catch (IllegalArgumentException e) {
            log.warn("RAG_EXTRACTION_VALIDATION_FAILED | fileName={} | error={}", fileName, e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("RAG_EXTRACTION_PROCESS_FAILED | fileName={} | error={}", fileName, e.getMessage(), e);
            throw new RuntimeException("Failed to extract text from document: " + e.getMessage(), e);
        }
    }
}
