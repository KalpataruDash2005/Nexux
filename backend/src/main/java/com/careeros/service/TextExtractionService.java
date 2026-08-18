package com.careeros.service;

import com.careeros.exception.BadRequestException;
import dev.langchain4j.data.document.BlankDocumentException;
import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.parser.apache.pdfbox.ApachePdfBoxDocumentParser;
import dev.langchain4j.data.document.parser.apache.tika.ApacheTikaDocumentParser;
import dev.langchain4j.data.document.source.FileSystemSource;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

@Service
@Slf4j
public class TextExtractionService {

    private static final int MIN_MEANINGFUL_CHARS = 100;
    private static final int OCR_DPI = 200;

    private final String configuredTesseractPath;
    private final ReentrantLock ocrLock = new ReentrantLock(true);
    private final Map<String, String> ocrCache = new ConcurrentHashMap<>();

    public TextExtractionService(@Value("${careeros.tesseract.path:}") String configuredTesseractPath) {
        this.configuredTesseractPath = configuredTesseractPath;
    }

    public Document extractDocument(Path path, String fileName) throws IOException {
        return extractDocument(path, fileName, -1);
    }

    public Document extractDocument(Path path, String fileName, int maxOcrPages) throws IOException {
        if (fileName != null && fileName.toLowerCase().endsWith(".pdf")) {
            return extractPdf(path, maxOcrPages);
        }
        return new ApacheTikaDocumentParser().parse(new FileSystemSource(path).inputStream());
    }

    private Document extractPdf(Path path, int maxOcrPages) throws IOException {
        String pdfBoxText = extractWithPdfBox(path);
        if (isMeaningful(pdfBoxText)) {
            return Document.from(cleanWatermarks(pdfBoxText));
        }

        log.warn("PDFBox extracted little usable text from {}, falling back to OCR", path);
        String ocrText = ocrPdfCached(path, maxOcrPages);
        if (!isMeaningful(ocrText)) {
            throw new BadRequestException(
                    "This file appears to be a scanned image with no readable text. " +
                            "OCR found nothing usable; please upload a clearer scan.");
        }

        Document ocrDoc = Document.from(cleanWatermarks(ocrText));
        try (PDDocument pdf = PDDocument.load(path.toFile())) {
            ocrDoc.metadata().put("page_count", pdf.getNumberOfPages());
        }
        return ocrDoc;
    }

    private String extractWithPdfBox(Path path) {
        try {
            Document doc = new ApachePdfBoxDocumentParser().parse(new FileSystemSource(path).inputStream());
            return doc.text();
        } catch (BlankDocumentException e) {
            return "";
        } catch (Exception e) {
            log.warn("PDFBox parsing failed for {}, treating as scanned image: {}", path, e.getMessage());
            return "";
        }
    }

    private String ocrPdfCached(Path path, int maxOcrPages) throws IOException {
        String cacheKey = path.toAbsolutePath().toString() + "|pages=" + maxOcrPages;
        String cached = ocrCache.get(cacheKey);
        if (cached != null) {
            log.info("Reusing cached OCR text for {}", path.getFileName());
            return cached;
        }

        // Only one OCR job at a time: prevents memory blowup from concurrent
        // extraction (e.g. a summary + background embedding running together).
        ocrLock.lock();
        try {
            cached = ocrCache.get(cacheKey);
            if (cached != null) {
                return cached;
            }
            String text = ocrPdf(path, maxOcrPages);
            ocrCache.put(cacheKey, text);
            return text;
        } finally {
            ocrLock.unlock();
        }
    }

    private boolean isMeaningful(String text) {
        if (text == null) return false;
        String cleaned = cleanWatermarks(text);
        if (countMeaningful(cleaned) < MIN_MEANINGFUL_CHARS) return false;
        Set<String> uniqueWords = new HashSet<>();
        for (String word : cleaned.split("\\s+")) {
            if (!word.isBlank()) {
                uniqueWords.add(word.toLowerCase());
            }
        }
        return uniqueWords.size() >= 30;
    }

    private String cleanWatermarks(String text) {
        if (text == null) return "";
        return text.replaceAll("(?i)\\s*scanned by camscanner\\s*", "\n")
                .replaceAll("(?i)\\s*camscanner\\s*", "\n");
    }

    private long countMeaningful(String text) {
        if (text == null) return 0;
        long count = 0;
        for (int i = 0; i < text.length(); i++) {
            if (!Character.isWhitespace(text.charAt(i))) count++;
        }
        return count;
    }

    private String ocrPdf(Path path, int maxOcrPages) throws IOException {
        String tesseract = resolveTesseract();
        List<String> pageTexts = new ArrayList<>();
        int pageCount;
        try (PDDocument pdf = PDDocument.load(path.toFile())) {
            pageCount = pdf.getNumberOfPages();
            int pagesToOcr = maxOcrPages > 0 ? Math.min(maxOcrPages, pageCount) : pageCount;
            log.info("OCR starting for {} ({} pages, will OCR {})", path.getFileName(), pageCount, pagesToOcr);
            PDFRenderer renderer = new PDFRenderer(pdf);
            for (int page = 0; page < pagesToOcr; page++) {
                BufferedImage image = renderer.renderImageWithDPI(page, OCR_DPI, ImageType.GRAY);
                File png = File.createTempFile("careeros-ocr-", ".png");
                try {
                    ImageIO.write(image, "png", png);
                    pageTexts.add(runTesseract(tesseract, png));
                } finally {
                    png.delete();
                }
                if ((page + 1) % 10 == 0) {
                    log.info("OCR progress: {}/{} pages done", page + 1, pagesToOcr);
                }
            }
        }
        String merged = String.join("\n", pageTexts);
        log.info("OCR finished for {}: {} pages, {} chars extracted", path.getFileName(), pageCount, merged.length());
        return merged;
    }

    private String runTesseract(String tesseract, File png) throws IOException {
        ProcessBuilder pb = new ProcessBuilder(tesseract, png.getAbsolutePath(), "stdout", "-l", "eng");
        pb.redirectErrorStream(false);
        pb.redirectError(ProcessBuilder.Redirect.DISCARD);
        Process proc = pb.start();
        try {
            if (!proc.waitFor(90, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                throw new IOException("Tesseract timed out on page " + png.getName());
            }
            return new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("OCR interrupted", e);
        }
    }

    private String resolveTesseract() {
        if (configuredTesseractPath != null && !configuredTesseractPath.isBlank()) {
            return configuredTesseractPath;
        }
        List<String> candidates = new ArrayList<>();
        String pathEnv = System.getenv("PATH");
        if (pathEnv != null) {
            for (String dir : pathEnv.split(java.util.regex.Pattern.quote(File.pathSeparator))) {
                if (!dir.isBlank()) {
                    candidates.add(dir + File.separator + "tesseract");
                    candidates.add(dir + File.separator + "tesseract.exe");
                }
            }
        }
        candidates.add("C:/Program Files/Tesseract-OCR/tesseract.exe");
        candidates.add(System.getProperty("user.home") + "/AppData/Local/Programs/Tesseract-OCR/tesseract.exe");
        for (String c : candidates) {
            if (Files.exists(Path.of(c))) {
                return c;
            }
        }
        throw new BadRequestException("Tesseract OCR is not installed. Install Tesseract OCR to extract text from scanned PDFs.");
    }
}
