package com.careeros.planner.service;

import com.careeros.exception.BadRequestException;
import com.careeros.planner.PlannerCategories;
import com.careeros.planner.config.PlannerProperties;
import com.careeros.planner.entity.AcademicEvent;
import com.careeros.service.TextExtractionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class PlannerExtractionService {

    private static final int LLM_MAX_RETRIES = 5;
    private static final int MAX_TEXT_CHARS = 12000;
    private static final int EXTRACT_MAX_RETRIES = 3;
    private static final int VERIFY_MAX_ITERATIONS = 2;
    private static final int MAX_CHUNKS = 4;
    private static final int CHUNK_MIN_CHARS = 4000;
    private static final int MAX_EVENTS_PER_SECTION = 400;
    private static final List<String> IMAGE_EXTENSIONS = List.of(".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final Pattern SECTION_HEADER = Pattern.compile(
            "(?i)^\\s*(WEEK\\s+\\d+|(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\\b.*)$");
    private static final Pattern NOTES_HEADER = Pattern.compile("(?i)\\bIMPORTANT\\s*(NOTES?|DATES?)\\b");

    private final PlannerProperties props;
    private final TextExtractionService textExtractionService;
    private final RestClient.Builder restClientBuilder;

    public PlannerExtractionService(PlannerProperties props,
                                    TextExtractionService textExtractionService,
                                    RestClient.Builder restClientBuilder) {
        this.props = props;
        this.textExtractionService = textExtractionService;
        this.restClientBuilder = restClientBuilder;
    }

    public record EventDraft(
            String title,
            String description,
            LocalDate date,
            LocalDate endDate,
            LocalTime startTime,
            LocalTime endTime,
            String category,
            String priority,
            String color,
            String location,
            String semester,
            Double confidence
    ) {
    }

    public record ExtractionResult(
            List<EventDraft> events,
            LocalDate semesterStart,
            LocalDate semesterEnd,
            List<String> warnings,
            String sourceFileName
    ) {
    }

    // ------------------------------------------------------------------
    // Entry point
    // ------------------------------------------------------------------

    public ExtractionResult extract(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was uploaded");
        }
        if (file.getSize() > props.getMaxFileSize()) {
            throw new BadRequestException("File is larger than the 20 MB limit");
        }
        String originalName = file.getOriginalFilename() == null ? "calendar" : file.getOriginalFilename();
        String lower = originalName.toLowerCase();

        Path stored = persist(file, originalName);
        try {
            if (lower.endsWith(".pdf")) {
                return extractFromPdf(stored, originalName);
            }
            if (IMAGE_EXTENSIONS.stream().anyMatch(lower::endsWith)) {
                String mime = guessMime(lower);
                return extractFromImage(stored, originalName, mime);
            }
            throw new BadRequestException("Unsupported file type. Upload a PDF, PNG, JPG or screenshot of your academic calendar.");
        } finally {
            try {
                Files.deleteIfExists(stored);
            } catch (IOException ignored) {
                // best effort cleanup of temp file
            }
        }
    }

    private Path persist(MultipartFile file, String originalName) {
        String extension = "";
        int dot = originalName.lastIndexOf('.');
        if (dot >= 0) {
            extension = originalName.substring(dot);
        }
        try {
            Path root = Path.of(props.getStorageDir(), UUID.randomUUID().toString());
            Files.createDirectories(root);
            Path target = root.resolve("upload" + extension);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return target;
        } catch (IOException e) {
            throw new BadRequestException("Failed to store the uploaded calendar: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // PDF path
    // ------------------------------------------------------------------

    private ExtractionResult extractFromPdf(Path path, String fileName) {
        String text;
        try {
            text = textExtractionService.extractDocument(path, fileName).text();
        } catch (Exception e) {
            throw new BadRequestException("Could not read the uploaded PDF: " + safeMessage(e));
        }
        if (text == null || text.isBlank() || text.strip().length() < 40) {
            throw new BadRequestException(
                    "No readable calendar content could be extracted from this PDF. "
                            + "Try uploading a higher quality file or a screenshot.");
        }
        if (text.length() > MAX_TEXT_CHARS) {
            text = text.substring(0, MAX_TEXT_CHARS);
        }
        return runMultiAgentPipeline(text, fileName);
    }

    // ------------------------------------------------------------------
    // Image / vision path
    // ------------------------------------------------------------------

    private ExtractionResult extractFromImage(Path path, String fileName, String mime) {
        // Preferred path: AI vision understands the layout of a calendar image.
        try {
            String base64;
            try {
                base64 = Base64.getEncoder().encodeToString(Files.readAllBytes(path));
            } catch (IOException e) {
                throw new BadRequestException("Could not read the uploaded image: " + safeMessage(e));
            }
            String dataUri = "data:" + mime + ";base64," + base64;
            return parseLlmResult(callVisionLlm(buildVisionPrompt(), dataUri), fileName);
        } catch (Exception visionError) {
            log.warn("AI vision failed for image {}, falling back to OCR: {}",
                    fileName, safeMessage(visionError));
            // Fallback: OCR the image with Tesseract and parse the extracted text.
            String text;
            try {
                text = ocrImage(path);
            } catch (Exception ocrError) {
                throw new BadRequestException(
                        "Could not read this image. AI vision is unavailable (" + safeMessage(visionError)
                                + ") and OCR failed (" + safeMessage(ocrError) + ").");
            }
            if (text == null || text.strip().length() < 40) {
                throw new BadRequestException(
                        "No readable calendar content could be extracted from this image. Try a clearer screenshot.");
            }
            if (text.length() > MAX_TEXT_CHARS) {
                text = text.substring(0, MAX_TEXT_CHARS);
            }
            return runMultiAgentPipeline(text, fileName);
        }
    }

    private String ocrImage(Path path) throws IOException {
        List<String> candidates = new ArrayList<>();
        String pathEnv = System.getenv("PATH");
        if (pathEnv != null) {
            for (String dir : pathEnv.split(";")) {
                if (!dir.isBlank()) {
                    candidates.add(dir + java.io.File.separator + "tesseract.exe");
                }
            }
        }
        candidates.add("C:/Program Files/Tesseract-OCR/tesseract.exe");
        candidates.add(System.getProperty("user.home") + "/AppData/Local/Programs/Tesseract-OCR/tesseract.exe");

        String tesseract = candidates.stream()
                .filter(c -> Files.exists(Path.of(c)))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "Tesseract OCR is not installed and AI vision is unavailable. "
                                + "Install Tesseract OCR or configure a vision-capable model to extract from images."));

        // Preprocess: upscale small images and map to a color-aware grayscale so
        // red/blue/highlighted text (common for exam dates) is dark instead of washed out.
        Path processed = preprocessForOcr(path);
        Path target = processed != null ? processed : path;
        try {
            ProcessBuilder pb = new ProcessBuilder(tesseract, target.toAbsolutePath().toString(), "stdout", "-l", "eng");
            pb.redirectErrorStream(false);
            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            Process proc = pb.start();
            try {
                if (!proc.waitFor(90, java.util.concurrent.TimeUnit.SECONDS)) {
                    proc.destroyForcibly();
                    throw new IOException("Tesseract timed out on " + path.getFileName());
                }
                return new String(proc.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("OCR interrupted", e);
            }
        } finally {
            if (processed != null) {
                try {
                    Files.deleteIfExists(processed);
                } catch (IOException ignored) {
                    // best effort
                }
            }
        }
    }

    private Path preprocessForOcr(Path source) throws IOException {
        try {
            java.awt.image.BufferedImage img = javax.imageio.ImageIO.read(source.toFile());
            if (img == null) {
                return null;
            }
            int srcW = img.getWidth();
            int srcH = img.getHeight();
            if (srcW <= 0 || srcH <= 0) {
                return null;
            }
            double scale = 1.0;
            int minDim = Math.min(srcW, srcH);
            if (minDim < 1500) {
                scale = Math.max(2.0, Math.round(1500.0 / minDim));
            }
            int w = (int) Math.max(1, Math.round(srcW * scale));
            int h = (int) Math.max(1, Math.round(srcH * scale));

            java.awt.image.BufferedImage gray = new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_BYTE_GRAY);
            int[] rgb = img.getRGB(0, 0, srcW, srcH, null, 0, srcW);
            int[] out = new int[w * h];
            for (int y = 0; y < h; y++) {
                int sy = Math.min(srcH - 1, (int) ((y * srcH) / h));
                for (int x = 0; x < w; x++) {
                    int sx = Math.min(srcW - 1, (int) ((x * srcW) / w));
                    int p = rgb[sy * srcW + sx];
                    int rr = (p >> 16) & 0xFF;
                    int gg = (p >> 8) & 0xFF;
                    int bb = p & 0xFF;
                    // min(R,G,B): keeps dark text AND saturated colored text (red/blue exam dates) dark.
                    out[y * w + x] = Math.min(rr, Math.min(gg, bb));
                }
            }
            gray.getRaster().setPixels(0, 0, w, h, out);

            Path processed = source.resolveSibling(source.getFileName() + ".preprocessed.png");
            boolean ok = javax.imageio.ImageIO.write(gray, "png", processed.toFile());
            return ok ? processed : null;
        } catch (Exception e) {
            log.warn("OCR preprocessing skipped: {}", safeMessage(e));
            return null;
        }
    }

    // ------------------------------------------------------------------
    // LLM calls
    // ------------------------------------------------------------------

    private String callTextLlm(String prompt) {
        return callTextLlm(buildSystemPrompt(), prompt, 2048);
    }

    private String callTextLlm(String systemPrompt, String prompt) {
        return callTextLlm(systemPrompt, prompt, 2048);
    }

    private String callTextLlm(String systemPrompt, String prompt, int maxTokens) {
        Map<String, Object> body = Map.of(
                "model", props.getLlmModel(),
                "temperature", 0.1,
                "max_tokens", maxTokens,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", prompt)
                )
        );
        return postCompletion(body);
    }

    private String callVisionLlm(String textPrompt, String dataUri) {
        Map<String, Object> userContent = Map.of(
                "type", "text",
                "text", textPrompt
        );
        Map<String, Object> imageContent = Map.of(
                "type", "image_url",
                "image_url", Map.of("url", dataUri)
        );
        Map<String, Object> body = Map.of(
                "model", props.getVisionModel(),
                "temperature", 0.1,
                "max_tokens", 2048,
                "messages", List.of(
                        Map.of("role", "system", "content", buildSystemPrompt()),
                        Map.of("role", "user", "content", List.of(userContent, imageContent))
                )
        );
        return postCompletion(body);
    }

    private String postCompletion(Map<String, Object> body) {
        Exception lastError = null;
        for (int attempt = 1; attempt <= LLM_MAX_RETRIES; attempt++) {
            try {
                Map<?, ?> json = restClientBuilder.build()
                        .post()
                        .uri(props.getLlmBaseUrl() + "/chat/completions")
                        .header("Authorization", "Bearer " + props.getLlmApiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(Map.class);
                if (json == null) {
                    throw new IllegalStateException("LLM returned an empty response");
                }
                List<?> choices = (List<?>) json.get("choices");
                if (choices == null || choices.isEmpty()) {
                    throw new IllegalStateException("LLM returned no choices");
                }
                Object first = choices.get(0);
                if (!(first instanceof Map<?, ?>)) {
                    throw new IllegalStateException("Unexpected LLM response shape");
                }
                Object message = ((Map<?, ?>) first).get("message");
                if (!(message instanceof Map<?, ?>)) {
                    throw new IllegalStateException("Unexpected LLM message shape");
                }
                Object content = ((Map<?, ?>) message).get("content");
                return content == null ? "" : String.valueOf(content);
            } catch (Exception e) {
                lastError = e;
                String msg = e.getMessage() == null ? "" : e.getMessage();
                boolean rateLimited = msg.contains("rate_limit_exceeded") || msg.contains("429");
                if (!rateLimited || attempt == LLM_MAX_RETRIES) {
                    throw new BadRequestException("AI extraction failed: " + safeMessage(e));
                }
                long waitMs = retryDelayMs(msg, attempt);
                log.warn("LLM rate limited (attempt {}), retrying in {} ms", attempt, waitMs);
                try {
                    Thread.sleep(waitMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new BadRequestException("Interrupted while waiting to retry AI extraction");
                }
            }
        }
        throw new BadRequestException("AI extraction failed after retries: " + safeMessage(lastError));
    }

    private long retryDelayMs(String message, int attempt) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("try again in (\\d+(?:\\.\\d+)?)\\s*s")
                .matcher(message == null ? "" : message);
        if (m.find()) {
            long seconds = (long) Math.ceil(Double.parseDouble(m.group(1)));
            if (seconds >= 1 && seconds <= 120) {
                return seconds * 1000L;
            }
        }
        return Math.min(4000L * (1L << (attempt - 1)), 60000L);
    }

    // ------------------------------------------------------------------
    // Prompts
    // ------------------------------------------------------------------

    private String buildSystemPrompt() {
        return """
                You are an expert Academic Calendar Parser.

                Your job is NOT OCR.
                Your job is to understand an academic calendar exactly like a human.

                The uploaded document is a university academic calendar. It contains:
                - Months
                - Weeks
                - Dates
                - Day columns
                - Colored event cells
                - Multi-day events
                - Important Notes

                You must analyze the entire table before extracting anything.

                --- CRITICAL RULES ---
                - Never guess dates.
                - Never infer missing information.
                - Never skip colored cells.
                - Never merge different events.
                - Every colored cell must be processed.

                --- STEP 1: UNDERSTAND THE CALENDAR LAYOUT ---
                Identify the year, semester, month sections, week rows and the Monday..Saturday day headers.
                Use these headers to calculate the actual date for every item.

                --- STEP 2: READ EVERY COLORED CELL ---
                Blue = Teaching events, Mid Semester, Weekly
                Green = Holiday, Festival, Vacation
                Yellow = Submission, Practical, Theory, Project
                Red = High priority, Exams
                Do not ignore any colored cells.

                --- STEP 3: EXTRACT EVERY EVENT ---
                Each event must contain:
                {
                  "title": "",
                  "date": "YYYY-MM-DD",
                  "category": "",
                  "priority": "HIGH or MEDIUM or LOW",
                  "description": "",
                  "color": "#RRGGBB",
                  "location": null,
                  "semester": null,
                  "confidence": 0.9
                }

                --- STEP 4: MULTI-DAY EVENTS ---
                If one event spans multiple consecutive dates, it must appear on EVERY date.
                Example: "Mid Sem Exam 17 18 19 20 21 22 Aug" must produce one record for 2026-08-17,
                2026-08-18, 2026-08-19, 2026-08-20, 2026-08-21 and 2026-08-22.
                DO NOT collapse a multi-day event into a single dated record.
                To keep the response compact for spans longer than 6 days, you may instead set
                date = first day and end_date = last day; the system expands those into one event per date automatically.
                A single-date statement like "Teaching End 3 Oct" stays a single event.

                --- STEP 5: IMPORTANT NOTES ---
                Read the IMPORTANT NOTES section and extract EVERY date mentioned (rescheduled exams, marks locking,
                vacations, new semester, end semester practicals, etc.). These events are OUTSIDE the calendar grid.
                Do NOT ignore them.

                --- TEXT-BASED CALENDARS (PDF text / OCR, no visible grid) ---
                When the input is a flat list of dated entries rather than a colored grid:
                - Extract ONLY the dated entries that are literally present. Do not invent a weekly or periodic series
                  (e.g. a generic "Weekly" or "Class" on every Saturday) that is not listed.
                - Do NOT treat "Semester Start" / "Semester End" header lines as events unless the calendar lists them
                  as events.
                - Do NOT emit two variants of the same event (e.g. both "Mid Semester" and
                  "Mid Semester Examination (Java, DBMS, CN)") — emit only what the calendar states.

                --- STEP 6: MERGE ---
                Sort events by date and remove duplicates only when BOTH title AND date are identical.

                --- STEP 7: OUTPUT ---
                Return ONLY valid JSON. Never markdown, never a summary, never an explanation.
                Use exactly this envelope:
                {
                  "semester_start": "YYYY-MM-DD or null",
                  "semester_end": "YYYY-MM-DD or null",
                  "events": [
                    {
                      "title": "Short, human-readable event title",
                      "description": "1-2 sentence description from the calendar text if present, else empty string",
                      "date": "YYYY-MM-DD",
                      "end_date": "YYYY-MM-DD or null",
                      "start_time": "HH:mm or null",
                      "end_time": "HH:mm or null",
                      "category": "one of EXAM, INTERNAL_EXAM, EXTERNAL_EXAM, PRACTICAL_EXAM, ASSIGNMENT, SUBMISSION, PROJECT, HACKATHON, WORKSHOP, SEMINAR, HOLIDAY, FESTIVAL, VACATION, SPORTS, PLACEMENT, INDUSTRIAL_VISIT, ORIENTATION, CONVOCATION, CLASS, OTHER",
                      "priority": "HIGH or MEDIUM or LOW",
                      "color": "hex color that fits the category (red=exam, amber=assignment, green=holiday, blue=workshop, purple=placement, orange=project)",
                      "location": "room/venue if present, else null",
                      "semester": "semester name if present, else null",
                      "confidence": 0.0 to 1.0
                    }
                  ]
                }

                Today's date is %s. Use it only to understand the academic year context, never to fill in missing dates.
                If a section has no readable events, return {"events": []}.
                """.formatted(LocalDate.now());
    }

    private String buildVisionPrompt() {
        return "This image is an academic calendar (or a screenshot of one). It may be a WEEK-BY-WEEK schedule "
                + "where each week row has its own date range, or a table with Week/Dates/Event columns, or a flat "
                + "list of dated events. Carefully read every row and every date, including colored/highlighted blocks "
                + "and key milestones like mid-sem exams, internal assessments, assignments, submissions and holidays, "
                + "and extract all events as JSON using the exact schema described in the system message. "
                + "Do not skip any event or any week.";
    }

    // ------------------------------------------------------------------
    // Multi-agent pipeline (text extraction): grid subagents + notes
    // subagent + completeness-critic loop + deterministic merge
    // ------------------------------------------------------------------

    private ExtractionResult runMultiAgentPipeline(String text, String fileName) {
        List<String> warnings = new ArrayList<>();

        // Peel off the IMPORTANT NOTES section so it gets its own dedicated pass.
        Matcher notesMatcher = NOTES_HEADER.matcher(text);
        int notesStart = notesMatcher.find() ? notesMatcher.start() : -1;
        String notesText = notesStart >= 0 ? text.substring(notesStart) : null;
        String gridText = notesStart >= 0 ? text.substring(0, notesStart) : text;

        List<String> sections = splitIntoSections(gridText);
        if (sections.isEmpty()) {
            sections = new ArrayList<>();
            sections.add(gridText);
        }

        List<RawEvent> all = new ArrayList<>();
        LocalDate semesterStart = null;
        LocalDate semesterEnd = null;

        // Subagents 1..N: one grid extractor per calendar section. Each reads
        // only its slice, applies the full expert prompt and returns JSON.
        for (int i = 0; i < sections.size(); i++) {
            RawExtraction parsed = extractSectionEvents(sections.get(i), (i + 1) + "/" + sections.size(), warnings);
            if (parsed.events() != null) {
                all.addAll(parsed.events());
            }
            if (semesterStart == null) {
                semesterStart = parsed.semesterStart();
            }
            if (semesterEnd == null) {
                semesterEnd = parsed.semesterEnd();
            }
        }

        // Subagent N+1: dedicated IMPORTANT NOTES extractor (events outside the grid).
        RawExtraction notesParsed = extractNotesEvents(notesText, warnings);
        if (notesParsed.events() != null) {
            all.addAll(notesParsed.events());
        }
        if (semesterStart == null) {
            semesterStart = notesParsed.semesterStart();
        }
        if (semesterEnd == null) {
            semesterEnd = notesParsed.semesterEnd();
        }

        // LOOPING: a completeness-critic agent reviews the ORIGINAL text against
        // everything found so far and reports ONLY what is still missing. Loop
        // until the critic finds nothing new (converged) or the cap is reached.
        all = verifyAndSupplement(text, all, warnings);

        // Deterministic source cross-check: for flat (non-grid) calendars, an event
        // is only trusted when its date is literally present in the text, and pure
        // metadata titles derived from semester headers are dropped.
        all = validateAgainstSource(all, text);

        List<EventDraft> drafts = toDraftsMerged(all, warnings);
        if (drafts.isEmpty()) {
            throw new BadRequestException(
                    "AI could not identify any events in this calendar. Try uploading a clearer file or screenshot.");
        }
        return new ExtractionResult(drafts, semesterStart, semesterEnd, warnings, fileName);
    }

    private List<String> splitIntoSections(String text) {
        String[] lines = text.split("\\r?\\n");
        List<String> sections = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String line : lines) {
            boolean header = isSectionHeader(line);
            boolean currentBig = current.length() > CHUNK_MIN_CHARS;
            boolean canSplit = sections.size() < MAX_CHUNKS - 1;
            boolean notBlank = !current.toString().isBlank();
            // Split at a week/month header only when the current section is already
            // substantial, so small calendars stay as ONE section for a single subagent.
            if (header && currentBig && canSplit && notBlank) {
                sections.add(current.toString());
                current = new StringBuilder();
            }
            current.append(line).append('\n');
            // Hard size cap: never hand one subagent a giant block.
            if (current.length() > CHUNK_MIN_CHARS * 2 && canSplit) {
                sections.add(current.toString());
                current = new StringBuilder();
            }
        }
        if (!current.toString().isBlank()) {
            sections.add(current.toString());
        }
        if (sections.isEmpty()) {
            sections.add(text);
        }
        return sections;
    }

    private boolean isSectionHeader(String line) {
        String trimmed = line.trim();
        return !trimmed.isEmpty() && SECTION_HEADER.matcher(trimmed).matches();
    }

    private RawExtraction extractSectionEvents(String section, String label, List<String> warnings) {
        String feedback = "";
        for (int attempt = 1; attempt <= EXTRACT_MAX_RETRIES; attempt++) {
            try {
                String raw = callTextLlm(buildSystemPrompt(), buildExtractorPrompt(section, label, feedback));
                RawExtraction parsed = parseLenient(extractJson(raw));
                if (parsed.events() != null && parsed.events().size() > MAX_EVENTS_PER_SECTION) {
                    feedback = "The previous response listed an implausible number of events. "
                            + "Re-extract strictly from the section text and keep only events that are explicitly present.";
                    continue;
                }
                return parsed;
            } catch (Exception e) {
                if (attempt == EXTRACT_MAX_RETRIES) {
                    warnings.add("Could not parse calendar section " + label + ": " + safeMessage(e));
                    return new RawExtraction(null, null, List.of());
                }
                // LOOP: feed the failure back and re-ask the subagent.
                feedback = "The previous attempt returned invalid JSON (" + safeMessage(e)
                        + "). Respond with ONLY valid JSON in the exact envelope described in the system message.";
            }
        }
        return new RawExtraction(null, null, List.of());
    }

    private RawExtraction extractNotesEvents(String notesText, List<String> warnings) {
        if (notesText == null || notesText.isBlank()) {
            return new RawExtraction(null, null, List.of());
        }
        String feedback = "";
        for (int attempt = 1; attempt <= EXTRACT_MAX_RETRIES; attempt++) {
            try {
                String raw = callTextLlm(buildSystemPrompt(), buildNotesPrompt(notesText, feedback));
                return parseLenient(extractJson(raw));
            } catch (Exception e) {
                if (attempt == EXTRACT_MAX_RETRIES) {
                    warnings.add("Could not parse the IMPORTANT NOTES section: " + safeMessage(e));
                    return new RawExtraction(null, null, List.of());
                }
                feedback = "The previous attempt returned invalid JSON (" + safeMessage(e)
                        + "). Respond with ONLY valid JSON in the exact envelope described in the system message.";
            }
        }
        return new RawExtraction(null, null, List.of());
    }

    private List<RawEvent> verifyAndSupplement(String originalText, List<RawEvent> all, List<String> warnings) {
        Set<String> known = new HashSet<>();
        for (RawEvent ev : all) {
            known.add(keyOf(ev));
        }
        List<RawEvent> working = new ArrayList<>(all);
        for (int round = 0; round < VERIFY_MAX_ITERATIONS; round++) {
            String summary = foundSummary(working);
            try {
                String raw = callTextLlm(buildVerifierSystemPrompt(), buildVerifierPrompt(originalText, summary, round + 1), 1024);
                RawExtraction parsed = parseLenient(extractJson(raw));
                List<RawEvent> missing = parsed.events() == null ? List.of() : parsed.events();
                List<RawEvent> added = new ArrayList<>();
                for (RawEvent ev : missing) {
                    if (known.contains(keyOf(ev)) || !plausibleAddition(ev, working)) {
                        continue;
                    }
                    known.add(keyOf(ev));
                    added.add(ev);
                }
                if (added.isEmpty()) {
                    // LOOP converged: the critic found nothing missing.
                    break;
                }
                working.addAll(added);
            } catch (Exception e) {
                warnings.add("Completeness verification could not run: " + safeMessage(e));
                break;
            }
        }
        return working;
    }

    /**
     * Guards against critic hallucinations: a candidate event is only accepted when it has a
     * parseable date and is not a near-duplicate variant (same date + one title contained in the
     * other) of an already-extracted event.
     */
    private boolean plausibleAddition(RawEvent candidate, List<RawEvent> existing) {
        if (candidate.date() == null || candidate.title() == null || candidate.title().isBlank()) {
            return false;
        }
        LocalDate candDate = parseDate(candidate.date());
        if (candDate == null) {
            return false;
        }
        String candTitle = normalizeForCompare(candidate.title());
        if (candTitle.isEmpty()) {
            return false;
        }
        for (RawEvent ex : existing) {
            LocalDate exDate = parseDate(ex.date());
            String exTitle = normalizeForCompare(ex.title());
            if (exTitle.isEmpty()) {
                continue;
            }
            if (exDate != null && exDate.isEqual(candDate)) {
                if (exTitle.contains(candTitle) || candTitle.contains(exTitle)) {
                    return false;
                }
            } else if (exTitle.contains(candTitle)) {
                // Candidate is a shorter variant of a fuller existing event on another date.
                return false;
            }
        }
        return true;
    }

    private static String normalizeForCompare(String title) {
        return title.toLowerCase().replaceAll("[^a-z0-9]+", " ").trim();
    }

    private static final List<String> METADATA_TITLES = List.of(
            "semester start", "semester end", "semester begins", "semester ends",
            "semester commencement", "teaching begins", "teaching ends", "teaching starts");

    /**
     * Deterministic guard against hallucinated events:
     * - Always drops pure metadata titles derived from "Semester Start/End" header lines.
     * - For FLAT (non-grid) calendars, additionally drops any event whose date does not
     *   literally appear in the source text. Week-based / day-column calendars keep
     *   computed dates untouched.
     */
    private List<RawEvent> validateAgainstSource(List<RawEvent> all, String originalText) {
        boolean flat = calendarLooksFlat(originalText);
        Set<String> metadata = new HashSet<>(METADATA_TITLES);
        List<RawEvent> out = new ArrayList<>();
        for (RawEvent ev : all) {
            String title = ev.title() == null ? "" : ev.title().trim();
            if (metadata.contains(normalizeForCompare(title))) {
                continue;
            }
            if (flat) {
                LocalDate date = parseDate(ev.date());
                if (date == null || !dateMentioned(date, originalText)) {
                    continue;
                }
            }
            out.add(ev);
        }
        return out;
    }

    private boolean calendarLooksFlat(String text) {
        String lower = text == null ? "" : text.toLowerCase();
        boolean hasWeekRows = Pattern.compile("(?i)\\bweek\\s*\\d+").matcher(lower).find();
        boolean hasDayHeaders = List.of("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
                .stream().anyMatch(lower::contains);
        return !hasWeekRows && !hasDayHeaders;
    }

    private boolean dateMentioned(LocalDate date, String text) {
        List<String> forms = List.of(
                date.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
                date.format(DateTimeFormatter.ofPattern("dd-MM-yyyy")),
                date.format(DateTimeFormatter.ofPattern("dd.MM.yyyy")),
                date.format(DateTimeFormatter.ofPattern("M/d/yyyy")),
                date.format(DateTimeFormatter.ofPattern("d/M/yyyy")),
                date.format(DateTimeFormatter.ofPattern("d MMM yyyy")),
                date.format(DateTimeFormatter.ofPattern("MMM d, yyyy")));
        for (String form : forms) {
            if (text.contains(form)) {
                return true;
            }
        }
        return false;
    }

    private static String keyOf(RawEvent ev) {
        String title = ev.title() == null ? "" : ev.title().trim().toLowerCase();
        String date = ev.date() == null ? "" : ev.date().trim();
        return title + "|" + date;
    }

    private String foundSummary(List<RawEvent> events) {
        List<RawEvent> sorted = new ArrayList<>(events);
        sorted.sort(Comparator.comparing(RawEvent::date, Comparator.nullsLast(Comparator.naturalOrder())));
        StringBuilder sb = new StringBuilder();
        for (RawEvent ev : sorted) {
            sb.append("- ").append(ev.date() == null ? "?" : ev.date())
                    .append(" | ").append(ev.title()).append('\n');
        }
        return sb.toString();
    }

    private String buildExtractorPrompt(String section, String label, String feedback) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are reviewing PART ").append(label).append(" of the full academic calendar.\n")
                .append("Extract EVERY event from this section exactly as instructed in the system message.\n")
                .append("The section may span one or more weeks; use the day headers and week date ranges to compute each date.\n")
                .append("Do not skip any colored cell, exam, assignment, submission, holiday or festival.\n\n")
                .append(section);
        if (!feedback.isBlank()) {
            sb.append("\n\n---\n").append(feedback);
        }
        return sb.toString();
    }

    private String buildNotesPrompt(String notesText, String feedback) {
        StringBuilder sb = new StringBuilder();
        sb.append("Below is the IMPORTANT NOTES section of an academic calendar. It contains events OUTSIDE the main grid.\n")
                .append("Extract every dated item (rescheduled exams, marks locking, vacations, semester starts/ends, ")
                .append("special practicals, etc.) as instructed in the system message.\n")
                .append("Only include items that actually carry a date.\n\n")
                .append(notesText);
        if (!feedback.isBlank()) {
            sb.append("\n\n---\n").append(feedback);
        }
        return sb.toString();
    }

    private String buildVerifierSystemPrompt() {
        return """
                You are a strict completeness critic for academic calendar extraction.
                You receive the ORIGINAL calendar text and the list of events ALREADY extracted.
                Your ONLY job: detect events that are EXPLICITLY present in the original calendar but MISSING from the extracted list.

                STRICT RULES (violating them is a serious error):
                - ONLY report an event whose title AND date are WRITTEN LITERALLY in the original calendar.
                - NEVER infer, approximate or compute a date that is not explicitly stated.
                - NEVER derive events from the semester start/end header lines, from week counts, or from
                  "teaching begins/ends" phrasing, unless the calendar explicitly lists them as dated events.
                - NEVER report a variant of an event that is already extracted (e.g. do not add "Mid Semester"
                  when "Mid Semester Examination (Java, DBMS, CN)" is already present).
                - NEVER report anything merely because it seems plausible. If in doubt, leave it out.
                - For multi-day events, only add them when the calendar explicitly shows a date range.

                Return ONLY the missing events in this envelope, or {"events": []} if nothing is missing:
                {
                  "semester_start": null,
                  "semester_end": null,
                  "events": [
                    {
                      "title": "...", "description": "...", "date": "YYYY-MM-DD", "end_date": null,
                      "start_time": null, "end_time": null,
                      "category": "EXAM | INTERNAL_EXAM | EXTERNAL_EXAM | PRACTICAL_EXAM | ASSIGNMENT | SUBMISSION | PROJECT | HACKATHON | WORKSHOP | SEMINAR | HOLIDAY | FESTIVAL | VACATION | SPORTS | PLACEMENT | INDUSTRIAL_VISIT | ORIENTATION | CONVOCATION | CLASS | OTHER",
                      "priority": "HIGH or MEDIUM or LOW",
                      "color": "#RRGGBB", "location": null, "semester": null, "confidence": 0.9
                    }
                  ]
                }
                No markdown, no prose.
                """;
    }

    private String buildVerifierPrompt(String originalText, String foundSummary, int round) {
        return "Verification round " + round + ". Compare the ORIGINAL calendar below against the ALREADY EXTRACTED list.\n"
                + "ALREADY EXTRACTED:\n" + foundSummary
                + "\nORIGINAL CALENDAR:\n" + originalText
                + "\n\nReturn ONLY the MISSING events as JSON. Return {\"events\": []} if nothing is missing.";
    }

    private List<EventDraft> toDraftsMerged(List<RawEvent> all, List<String> warnings) {
        Map<String, EventDraft> unique = new LinkedHashMap<>();
        for (RawEvent ev : all) {
            try {
                for (EventDraft draft : toDrafts(ev, warnings)) {
                    unique.putIfAbsent(draft.title().trim() + "|" + draft.date(), draft);
                }
            } catch (Exception e) {
                warnings.add("Skipped an unreadable entry: " + safeMessage(e));
            }
        }
        List<EventDraft> drafts = new ArrayList<>(unique.values());
        drafts.sort(Comparator.comparing(EventDraft::date));
        return drafts;
    }

    // ------------------------------------------------------------------
    // Parsing + validation
    // ------------------------------------------------------------------

    private ExtractionResult parseLlmResult(String raw, String sourceFileName) {
        String json = extractJson(raw);
        RawExtraction parsed = parseLenient(json);

        List<EventDraft> drafts = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        for (RawEvent rawEvent : parsed.events() == null ? List.<RawEvent>of() : parsed.events()) {
            try {
                drafts.addAll(toDrafts(rawEvent, warnings));
            } catch (Exception e) {
                warnings.add("Skipped an unreadable entry: " + safeMessage(e));
            }
        }
        if (drafts.isEmpty()) {
            throw new BadRequestException(
                    "AI could not identify any events in this calendar. Try uploading a clearer file or screenshot.");
        }
        return new ExtractionResult(drafts, parsed.semesterStart(), parsed.semesterEnd(), warnings, sourceFileName);
    }

    private static final Set<String> MULTI_DAY_CATEGORIES = Set.of(
            "EXAM", "INTERNAL_EXAM", "EXTERNAL_EXAM", "PRACTICAL_EXAM",
            "HOLIDAY", "VACATION", "FESTIVAL", "WORKSHOP", "SEMINAR",
            "INDUSTRIAL_VISIT", "HACKATHON", "PLACEMENT", "ORIENTATION", "CONVOCATION");

    private List<EventDraft> toDrafts(RawEvent e, List<String> warnings) {
        if (e.title() == null || e.title().isBlank()) {
            return List.of();
        }
        String title = e.title().trim();
        LocalDate date = parseDate(e.date());
        if (date == null) {
            warnings.add("Skipped \"" + title + "\" because its date could not be read.");
            return List.of();
        }
        LocalDate endDate = parseDate(e.end_date());
        String category = PlannerCategories.refineByTitle(title, PlannerCategories.normalize(e.category()));
        Double confidence = e.confidence() == null ? 0.7 : e.confidence();
        if (confidence < 0.0 || confidence > 1.0) {
            confidence = 0.7;
        }
        String description = e.description() == null ? "" : e.description().trim();

        // Multi-day periods (exam weeks, holidays, festivals, placements) become one
        // event per day so the daily schedule, today-focus and countdown all reflect
        // the full span instead of collapsing it to a single date.
        if (endDate != null && endDate.isAfter(date) && MULTI_DAY_CATEGORIES.contains(category)) {
            long span = ChronoUnit.DAYS.between(date, endDate) + 1;
            if (span > 1 && span <= 60) {
                List<EventDraft> expanded = new ArrayList<>();
                for (long i = 0; i < span; i++) {
                    LocalDate day = date.plusDays(i);
                    expanded.add(new EventDraft(
                            title,
                            description,
                            day,
                            null,
                            i == 0 ? parseTime(e.start_time()) : null,
                            null,
                            category,
                            normalizePriority(e.priority(), category),
                            validColor(e.color()) ? e.color() : AcademicEvent.defaultColor(category),
                            blankToNull(e.location()),
                            blankToNull(e.semester()),
                            confidence
                    ));
                }
                return expanded;
            }
        }

        return List.of(new EventDraft(
                title,
                description,
                date,
                null,
                parseTime(e.start_time()),
                parseTime(e.end_time()),
                category,
                normalizePriority(e.priority(), category),
                validColor(e.color()) ? e.color() : AcademicEvent.defaultColor(category),
                blankToNull(e.location()),
                blankToNull(e.semester()),
                confidence
        ));
    }

    private String normalizePriority(String priority, String category) {
        if (priority == null) {
            return AcademicEvent.inferPriority(category);
        }
        String p = priority.trim().toUpperCase();
        if (p.equals("HIGH") || p.equals("MEDIUM") || p.equals("LOW")) {
            return p;
        }
        return AcademicEvent.inferPriority(category);
    }

    private boolean validColor(String color) {
        if (color == null || color.isBlank()) {
            return false;
        }
        return color.matches("^#[0-9a-fA-F]{6}$");
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        try {
            return LocalDate.parse(trimmed, DATE_FMT);
        } catch (DateTimeParseException e) {
            for (DateTimeFormatter fmt : List.of(
                    DateTimeFormatter.ofPattern("yyyy/M/d"),
                    DateTimeFormatter.ofPattern("M/d/yyyy"),
                    DateTimeFormatter.ofPattern("d-M-yyyy"),
                    DateTimeFormatter.ofPattern("d/M/yyyy"),
                    DateTimeFormatter.ofPattern("MMM d, yyyy"),
                    DateTimeFormatter.ofPattern("d MMM yyyy")
            )) {
                try {
                    return LocalDate.parse(trimmed, fmt);
                } catch (DateTimeParseException ignored) {
                    // try next format
                }
            }
            return null;
        }
    }

    private LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        for (DateTimeFormatter fmt : List.of(
                DateTimeFormatter.ofPattern("HH:mm"),
                DateTimeFormatter.ofPattern("H:mm"),
                DateTimeFormatter.ofPattern("HH:mm:ss"),
                DateTimeFormatter.ofPattern("h:mm a"),
                DateTimeFormatter.ofPattern("h a")
        )) {
            try {
                return LocalTime.parse(trimmed.toUpperCase(), fmt);
            } catch (DateTimeParseException ignored) {
                // try next format
            }
        }
        return null;
    }

    private String extractJson(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("AI returned an empty response");
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new BadRequestException("AI response was not valid JSON");
        }
        return raw.substring(start, end + 1);
    }

    @SuppressWarnings("unchecked")
    private RawExtraction parseLenient(String json) {
        try {
            Map<String, Object> root = ObjectMapperHolder.MAPPER.readValue(json, Map.class);
            LocalDate semesterStart = parseDate(stringOrNull(root.get("semester_start")));
            LocalDate semesterEnd = parseDate(stringOrNull(root.get("semester_end")));
            List<RawEvent> events = new ArrayList<>();
            Object rawEvents = root.get("events");
            if (rawEvents instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> map) {
                        events.add(new RawEvent(
                                stringOrNull(map.get("title")),
                                stringOrNull(map.get("description")),
                                stringOrNull(map.get("date")),
                                stringOrNull(map.get("end_date")),
                                stringOrNull(map.get("start_time")),
                                stringOrNull(map.get("end_time")),
                                stringOrNull(map.get("category")),
                                stringOrNull(map.get("priority")),
                                stringOrNull(map.get("color")),
                                stringOrNull(map.get("location")),
                                stringOrNull(map.get("semester")),
                                numberOrNull(map.get("confidence"))
                        ));
                    }
                }
            }
            return new RawExtraction(semesterStart, semesterEnd, events);
        } catch (Exception e) {
            throw new BadRequestException("AI returned events in an unexpected format: " + safeMessage(e));
        }
    }

    private static String stringOrNull(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        if (s.isEmpty() || s.equalsIgnoreCase("null")) {
            return null;
        }
        return s;
    }

    private static Double numberOrNull(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Double.valueOf(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private record RawExtraction(LocalDate semesterStart, LocalDate semesterEnd, List<RawEvent> events) {
    }

    private record RawEvent(
            String title,
            String description,
            String date,
            String end_date,
            String start_time,
            String end_time,
            String category,
            String priority,
            String color,
            String location,
            String semester,
            Double confidence
    ) {
    }

    private String guessMime(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".bmp")) return "image/bmp";
        if (lower.endsWith(".gif")) return "image/gif";
        return "image/png";
    }

    private static String safeMessage(Throwable t) {
        return t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
    }

    // Small holder to avoid pulling a dedicated static mapper into this class.
    private static final class ObjectMapperHolder {
        private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER =
                new com.fasterxml.jackson.databind.ObjectMapper();
    }
}
