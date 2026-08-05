package com.careeros.placement.service;

import com.careeros.entity.User;
import com.careeros.exception.BadRequestException;
import com.careeros.placement.dto.*;
import com.careeros.placement.entity.PlacementMessage;
import com.careeros.placement.entity.PlacementResume;
import com.careeros.placement.entity.PlacementResumeAnalysis;
import com.careeros.placement.entity.PlacementSession;
import com.careeros.placement.repository.PlacementMessageRepository;
import com.careeros.placement.repository.PlacementResumeAnalysisRepository;
import com.careeros.placement.repository.PlacementResumeRepository;
import com.careeros.placement.repository.PlacementSessionRepository;
import com.careeros.repository.UserRepository;
import com.careeros.service.TextExtractionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.document.Document;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
public class PlacementService {

    private static final Set<String> INTERVIEW_TYPES = Set.of(
            "MOCK", "ROLE", "COMPANY", "TECHNICAL", "HR", "BEHAVIORAL", "PROJECT", "DSA_ORAL");
    private static final Set<String> ALL_TYPES = Set.of(
            "MOCK", "ROLE", "COMPANY", "TECHNICAL", "HR", "BEHAVIORAL", "PROJECT", "DSA_ORAL", "CODING", "APTITUDE");
    private static final Set<String> APTITUDE_CATEGORIES = Set.of(
            "QUANTITATIVE", "LOGICAL", "VERBAL", "PUZZLE", "DI");
    private static final int STRATEGY_CACHE_MS = 15 * 60 * 1000;
    private static final int MAX_QUESTIONS = 10;

    private final PlacementResumeRepository resumeRepository;
    private final PlacementResumeAnalysisRepository analysisRepository;
    private final PlacementSessionRepository sessionRepository;
    private final PlacementMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final TextExtractionService textExtractionService;
    private final PlacementAiService ai;
    private final ObjectMapper objectMapper;

    private final Map<String, CacheEntry> readinessCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry> roadmapCache = new ConcurrentHashMap<>();

    private record CacheEntry(Instant until, Object body) {}

    private record ReadinessResult(int score, String label) {}

    public PlacementService(PlacementResumeRepository resumeRepository,
                            PlacementResumeAnalysisRepository analysisRepository,
                            PlacementSessionRepository sessionRepository,
                            PlacementMessageRepository messageRepository,
                            UserRepository userRepository,
                            TextExtractionService textExtractionService,
                            PlacementAiService ai,
                            ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.analysisRepository = analysisRepository;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.textExtractionService = textExtractionService;
        this.ai = ai;
        this.objectMapper = objectMapper;
    }

    // ------------------------------------------------------------------
    // Resume
    // ------------------------------------------------------------------

    @Transactional
    public AnalyzeResumeResponse analyzeResume(String ownerEmail, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Please select a resume file to upload.");
        }
        String fileName = file.getOriginalFilename() == null ? "resume.pdf" : file.getOriginalFilename();
        String ext = "";
        int dot = fileName.lastIndexOf('.');
        if (dot >= 0) {
            ext = fileName.substring(dot);
        }
        Path temp = null;
        try {
            temp = Files.createTempFile("careeros-resume-", ext);
            file.transferTo(temp.toFile());
            Document doc = textExtractionService.extractDocument(temp, fileName);
            String text = doc.text() == null ? "" : doc.text().trim();
            if (text.length() < 80) {
                throw new BadRequestException("No readable text found in the resume. Please upload a clear PDF/DOC file.");
            }

            User owner = resolveOwner(ownerEmail);
            PlacementResume resume = PlacementResume.builder()
                    .owner(owner)
                    .fileName(fileName)
                    .text(text)
                    .build();
            resumeRepository.save(resume);

            AnalyzeResumeResponse.Analysis analysis = ai.analyzeResumeText(text);
            PlacementResumeAnalysis saved = PlacementResumeAnalysis.builder()
                    .resumeId(resume.getId())
                    .owner(owner)
                    .analysisJson(writeJson(analysis))
                    .build();
            analysisRepository.save(saved);

            return new AnalyzeResumeResponse(resume.getId(), fileName, text.length(), analysis);
        } catch (BadRequestException e) {
            throw e;
        } catch (IOException e) {
            throw new BadRequestException("Could not read the uploaded file: " + safeMessage(e));
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                    // best-effort cleanup
                }
            }
        }
    }

    public LatestResumeResponse getLatestResume(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        Optional<PlacementResumeAnalysis> latest = analysisRepository.findTopByOwnerIdOrderByCreatedAtDesc(owner.getId());
        if (latest.isEmpty()) {
            return new LatestResumeResponse(null, null, 0, null);
        }
        PlacementResumeAnalysis analysis = latest.get();
        PlacementResume resume = resumeRepository.findById(analysis.getResumeId()).orElse(null);
        return new LatestResumeResponse(
                analysis.getResumeId(),
                resume == null ? null : resume.getFileName(),
                resume == null ? 0 : (resume.getText() == null ? 0 : resume.getText().length()),
                readJson(analysis.getAnalysisJson(), AnalyzeResumeResponse.Analysis.class));
    }

    public List<ResumeListItem> getResumes(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        return resumeRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId()).stream()
                .map(r -> {
                    Optional<PlacementResumeAnalysis> analysis = analysisRepository.findTopByResumeIdOrderByCreatedAtDesc(r.getId());
                    String analyzedAt = analysis.map(a -> a.getCreatedAt().toString()).orElse(null);
                    return new ResumeListItem(r.getId(), r.getFileName(),
                            r.getText() == null ? 0 : r.getText().length(), analyzedAt);
                })
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------
    // Sessions (interviews, coding, aptitude)
    // ------------------------------------------------------------------

    public PlacementSessionDto createSession(String ownerEmail, CreateSessionRequest req) {
        if (req.type() == null || !ALL_TYPES.contains(req.type())) {
            throw new BadRequestException("Invalid session type: " + req.type());
        }
        User owner = resolveOwner(ownerEmail);
        String resumeText = null;
        if (req.mode() != null && "RESUME".equalsIgnoreCase(req.mode())) {
            if (req.resumeId() == null || req.resumeId().isBlank()) {
                throw new BadRequestException("Resume-based interviews require a resumeId.");
            }
            PlacementResume resume = resumeRepository.findByIdAndOwnerId(req.resumeId(), owner.getId())
                    .orElseThrow(() -> new BadRequestException("Resume not found or access denied"));
            resumeText = resume.getText();
        }

        PlacementSession session = PlacementSession.builder()
                .owner(owner)
                .type(req.type())
                .mode(req.mode() == null ? "AI" : req.mode().toUpperCase())
                .role(req.role())
                .company(req.company())
                .difficulty(req.difficulty() == null ? "MEDIUM" : req.difficulty().toUpperCase())
                .status("ACTIVE")
                .build();
        sessionRepository.save(session);

        if (resumeText != null) {
            session.setPayloadJson(resumeText);
            sessionRepository.save(session);
        }
        return toDto(session);
    }

    public StartSessionResponse startSession(String ownerEmail, String id) {
        PlacementSession session = requireSession(ownerEmail, id);
        if (!INTERVIEW_TYPES.contains(session.getType())) {
            throw new BadRequestException("Only interview sessions can be started this way.");
        }
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new BadRequestException("Session is not active.");
        }
        String question = ai.firstQuestion(session.getType(), session.getRole(), session.getCompany(),
                session.getDifficulty(), session.getPayloadJson());
        User owner = resolveOwner(ownerEmail);
        messageRepository.save(PlacementMessage.builder()
                .sessionId(session.getId())
                .owner(owner)
                .role("ASSISTANT")
                .content(question)
                .build());
        session.setStartedAt(LocalDateTime.now());
        sessionRepository.save(session);
        return new StartSessionResponse(session.getId(), question);
    }

    @Transactional
    public SendMessageResponse sendMessage(String ownerEmail, String id, String content) {
        PlacementSession session = requireSession(ownerEmail, id);
        if (!INTERVIEW_TYPES.contains(session.getType())) {
            throw new BadRequestException("Only interview sessions accept chat messages.");
        }
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new BadRequestException("Session is already completed.");
        }
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Message content cannot be empty.");
        }
        User owner = resolveOwner(ownerEmail);

        List<PlacementMessage> existing = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
        List<String> historyLines = toHistoryLines(existing);
        PlacementMessage userMessage = PlacementMessage.builder()
                .sessionId(session.getId())
                .owner(owner)
                .role("USER")
                .content(content)
                .build();
        messageRepository.save(userMessage);

        InterviewFeedback feedback = ai.evaluateAnswer(session.getType(), session.getRole(), session.getCompany(),
                session.getDifficulty(), historyLines, content);

        String finalSummary = null;
        boolean shouldEnd = feedback.shouldEnd();
        int turnCount = 0;
        for (PlacementMessage m : existing) {
            if ("ASSISTANT".equals(m.getRole())) {
                turnCount++;
            }
        }
        if (shouldEnd || turnCount + 1 >= MAX_QUESTIONS) {
            finalSummary = feedback.finalSummary() == null || feedback.finalSummary().isBlank()
                    ? "Interview completed."
                    : feedback.finalSummary();
            session.setStatus("COMPLETED");
            session.setScore(feedback.score());
            session.setSummary(finalSummary);
            session.setEndedAt(LocalDateTime.now());
            sessionRepository.save(session);
            return new SendMessageResponse(feedback, true, finalSummary);
        }

        PlacementMessage assistant = PlacementMessage.builder()
                .sessionId(session.getId())
                .owner(owner)
                .role("ASSISTANT")
                .content(feedback.nextQuestion() == null ? "" : feedback.nextQuestion())
                .analysisJson(writeJson(feedback))
                .build();
        messageRepository.save(assistant);
        session.setScore(feedback.score());
        sessionRepository.save(session);
        return new SendMessageResponse(feedback, false, null);
    }

    @Transactional
    public EndSessionResponse endSession(String ownerEmail, String id) {
        PlacementSession session = requireSession(ownerEmail, id);
        if (!"ACTIVE".equals(session.getStatus())) {
            return new EndSessionResponse(session.getScore(),
                    session.getSummary() == null ? "Interview completed." : session.getSummary(),
                    (int) messageRepository.countBySessionId(session.getId()));
        }
        List<PlacementMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
        List<Integer> scored = new ArrayList<>();
        for (PlacementMessage m : messages) {
            if (m.getAnalysisJson() != null) {
                InterviewFeedback fb = readAnalysis(m.getAnalysisJson());
                if (fb != null) {
                    scored.add(fb.score());
                }
            }
        }
        Integer score = null;
        if (!scored.isEmpty()) {
            double avg = scored.stream().mapToInt(Integer::intValue).average().orElse(0);
            score = (int) Math.round(avg);
        } else if (session.getScore() != null) {
            score = session.getScore();
        }
        session.setStatus("COMPLETED");
        session.setScore(score);
        session.setSummary(session.getSummary() == null ? "Interview completed." : session.getSummary());
        session.setEndedAt(LocalDateTime.now());
        sessionRepository.save(session);
        return new EndSessionResponse(score, session.getSummary(), (int) messageRepository.countBySessionId(session.getId()));
    }

    public List<PlacementSessionDto> getSessions(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        return sessionRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId()).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public PlacementResetResponse resetAll(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        List<PlacementSession> sessions = sessionRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId());
        List<PlacementResume> resumes = resumeRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId());
        int sessionCount = sessions.size();
        int resumeCount = resumes.size();
        if (!sessions.isEmpty()) {
            sessionRepository.deleteAll(sessions);
        }
        if (!resumes.isEmpty()) {
            resumeRepository.deleteAll(resumes);
        }
        readinessCache.remove(ownerEmail);
        roadmapCache.remove(ownerEmail);
        log.info("Placement activity reset for user {}: {} sessions, {} resumes removed",
                ownerEmail, sessionCount, resumeCount);
        return new PlacementResetResponse(true, sessionCount, resumeCount);
    }

    public SessionDetailResponse getSessionDetail(String ownerEmail, String id) {
        PlacementSession session = requireSession(ownerEmail, id);
        List<MessageDto> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId()).stream()
                .map(m -> new MessageDto(m.getId(), m.getRole(), m.getContent(),
                        m.getAnalysisJson() == null ? null : readAnalysis(m.getAnalysisJson()),
                        m.getCreatedAt().toString()))
                .collect(Collectors.toList());
        return new SessionDetailResponse(toDto(session), messages);
    }

    // ------------------------------------------------------------------
    // Coding
    // ------------------------------------------------------------------

    @Transactional
    public CreateCodingResponse createCodingSession(String ownerEmail, CreateCodingRequest req) {
        User owner = resolveOwner(ownerEmail);
        CodingProblem problem = ai.generateCodingProblem(req.role(), req.topic(), req.difficulty(),
                usedCodingTitles(owner.getId()));
        PlacementSession session = PlacementSession.builder()
                .owner(owner)
                .type("CODING")
                .mode("AI")
                .role(req.role())
                .topic(req.topic())
                .difficulty(req.difficulty() == null ? "MEDIUM" : req.difficulty().toUpperCase())
                .status("ACTIVE")
                .payloadJson(writeJson(problem))
                .startedAt(LocalDateTime.now())
                .build();
        sessionRepository.save(session);
        return new CreateCodingResponse(session.getId(), problem);
    }

    @Transactional
    public SubmitCodingResponse submitCoding(String ownerEmail, String id, SubmitCodingRequest req) {
        PlacementSession session = requireSession(ownerEmail, id);
        if (!"CODING".equals(session.getType())) {
            throw new BadRequestException("This session is not a coding session.");
        }
        if (req.code() == null || req.code().isBlank()) {
            throw new BadRequestException("Please write some code before submitting.");
        }
        CodingProblem problem = readJson(session.getPayloadJson(), CodingProblem.class);
        if (problem == null) {
            throw new BadRequestException("Coding problem payload is missing.");
        }
        CodingEvaluation evaluation = ai.evaluateCode(problem,
                req.language() == null ? "java" : req.language(), req.code());

        int totalScore = (int) Math.round(0.5 * evaluation.correctness()
                + 0.2 * evaluation.codeQuality()
                + 0.1 * evaluation.naming()
                + 0.2 * evaluation.optimization());
        boolean passed = evaluation.correctness() >= 75;

        User owner = resolveOwner(ownerEmail);
        messageRepository.save(PlacementMessage.builder()
                .sessionId(session.getId())
                .owner(owner)
                .role("USER")
                .content("Language: " + (req.language() == null ? "java" : req.language()) + "\n\n" + req.code())
                .analysisJson(writeJson(evaluation))
                .build());

        session.setStatus("COMPLETED");
        session.setScore(totalScore);
        session.setSummary(evaluation.feedback());
        session.setEndedAt(LocalDateTime.now());
        sessionRepository.save(session);

        return new SubmitCodingResponse(evaluation, passed, totalScore);
    }

    // ------------------------------------------------------------------
    // Aptitude
    // ------------------------------------------------------------------

    @Transactional
    public CreateAptitudeResponse createAptitudeTest(String ownerEmail, CreateAptitudeRequest req) {
        String category = req.category() == null ? "QUANTITATIVE" : req.category().toUpperCase();
        if (!APTITUDE_CATEGORIES.contains(category)) {
            throw new BadRequestException("Invalid aptitude category: " + category);
        }
        int count = req.count() == null ? 10 : Math.max(5, Math.min(req.count(), 15));
        User owner = resolveOwner(ownerEmail);
        AptitudeTestDto test = ai.generateAptitudeTest(category, req.difficulty(), count,
                usedAptitudeQuestions(owner.getId()));

        PlacementSession session = PlacementSession.builder()
                .owner(owner)
                .type("APTITUDE")
                .mode("AI")
                .topic(category)
                .difficulty(req.difficulty() == null ? "MEDIUM" : req.difficulty().toUpperCase())
                .status("ACTIVE")
                .payloadJson(writeJson(test))
                .startedAt(LocalDateTime.now())
                .build();
        sessionRepository.save(session);
        return new CreateAptitudeResponse(session.getId(), test.forClient());
    }

    @Transactional
    public SubmitAptitudeResponse submitAptitude(String ownerEmail, String id, SubmitAptitudeRequest req) {
        PlacementSession session = requireSession(ownerEmail, id);
        if (!"APTITUDE".equals(session.getType())) {
            throw new BadRequestException("This session is not an aptitude test.");
        }
        AptitudeTestDto test = readJson(session.getPayloadJson(), AptitudeTestDto.class);
        if (test == null || test.questions() == null || test.questions().isEmpty()) {
            throw new BadRequestException("Aptitude test payload is missing.");
        }
        Map<String, AptitudeTestDto.Question> byId = test.questions().stream()
                .collect(Collectors.toMap(AptitudeTestDto.Question::id, Function.identity()));
        Map<String, Integer> submitted = new HashMap<>();
        if (req.answers() != null) {
            for (AptitudeAnswerRequest a : req.answers()) {
                submitted.put(a.questionId(), a.selectedIndex());
            }
        }

        int correct = 0;
        List<AptitudeResultItem> detailed = new ArrayList<>();
        for (AptitudeTestDto.Question q : test.questions()) {
            int correctIndex = q.correctAnswerIndex() == null ? -1 : q.correctAnswerIndex();
            Integer selected = submitted.get(q.id());
            int yourAnswer = selected == null ? -1 : selected;
            boolean isCorrect = yourAnswer >= 0 && yourAnswer == correctIndex;
            if (isCorrect) {
                correct++;
            }
            detailed.add(new AptitudeResultItem(q.id(), isCorrect, correctIndex, yourAnswer,
                    q.explanation() == null ? "" : q.explanation()));
        }
        int total = test.questions().size();
        int percentage = total == 0 ? 0 : (int) Math.round(correct * 100.0 / total);

        session.setStatus("COMPLETED");
        session.setScore(percentage);
        session.setSummary("Scored " + correct + "/" + total + " (" + percentage + "%)");
        session.setEndedAt(LocalDateTime.now());
        sessionRepository.save(session);

        return new SubmitAptitudeResponse(correct, total, percentage, true, detailed);
    }

    // ------------------------------------------------------------------
    // Dashboard
    // ------------------------------------------------------------------

    public DashboardResponse getDashboard(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        LocalDate today = LocalDate.now();
        List<PlacementSession> sessions = sessionRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId());
        int resumeScore = latestResumeScore(owner.getId());

        List<PlacementSession> completed = sessions.stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()))
                .collect(Collectors.toList());
        long interviewsCompleted = completed.stream()
                .filter(s -> INTERVIEW_TYPES.contains(s.getType())).count();
        long codingProblems = completed.stream()
                .filter(s -> "CODING".equals(s.getType())).count();
        long questionsAnswered = messageRepository.countByOwnerIdAndRole(owner.getId(), "USER");
        long sessionsToday = sessions.stream()
                .filter(s -> s.getCreatedAt().toLocalDate().equals(today)).count();
        long questionsToday = messageRepository.countByOwnerIdAndRoleAndCreatedAtGreaterThanEqual(
                owner.getId(), "USER", today.atStartOfDay());

        int streak = computeStreak(sessions, today);

        Map<String, Integer> weaknessCounts = new HashMap<>();
        Map<String, Integer> strengthCounts = new HashMap<>();
        collectTopicCounts(owner, weaknessCounts, strengthCounts);
        List<String> weakAreas = topKeys(weaknessCounts, 3);
        List<String> strongAreas = topKeys(strengthCounts, 3);
        if (weakAreas.isEmpty() || strongAreas.isEmpty()) {
            AnalyzeResumeResponse.Analysis analysis = latestAnalysis(owner.getId());
            if (analysis != null) {
                if (weakAreas.isEmpty() && analysis.missingSkills() != null) {
                    weakAreas = analysis.missingSkills().stream().limit(3).toList();
                }
                if (strongAreas.isEmpty() && analysis.skills() != null) {
                    strongAreas = analysis.skills().stream().limit(3).toList();
                }
            }
        }

        List<DashboardResponse.DayScore> weekly = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            List<PlacementSession> daySessions = sessions.stream()
                    .filter(s -> s.getCreatedAt().toLocalDate().equals(d) && s.getScore() != null)
                    .collect(Collectors.toList());
            int score = daySessions.isEmpty() ? 0
                    : (int) Math.round(daySessions.stream().mapToInt(PlacementSession::getScore).average().orElse(0));
            weekly.add(new DashboardResponse.DayScore(d.getDayOfWeek().getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH), score));
        }

        List<DashboardResponse.RecentFeedback> recent = completed.stream()
                .filter(s -> s.getScore() != null && s.getSummary() != null)
                .sorted(Comparator.comparing(PlacementSession::getEndedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .limit(5)
                .map(s -> new DashboardResponse.RecentFeedback(
                        s.getCompany() == null || s.getCompany().isBlank() ? s.getType() : s.getCompany() + " " + s.getType(),
                        s.getType(),
                        s.getEndedAt() == null ? s.getCreatedAt().toLocalDate().toString() : s.getEndedAt().toLocalDate().toString(),
                        s.getSummary()))
                .collect(Collectors.toList());

        ReadinessResult readiness = computeReadiness(owner.getId(), resumeScore);
        return new DashboardResponse(readiness.score(), readiness.label(), streak, (int) questionsAnswered,                (int) interviewsCompleted, (int) codingProblems, resumeScore,
                new DashboardResponse.TodayPractice((int) sessionsToday, (int) questionsToday, 10),
                weakAreas, strongAreas, weekly, recent);
    }

    // ------------------------------------------------------------------
    // Analytics
    // ------------------------------------------------------------------

    public AnalyticsResponse getAnalytics(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        LocalDate today = LocalDate.now();
        List<PlacementSession> completed = sessionRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId()).stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()) && s.getScore() != null)
                .collect(Collectors.toList());

        int technical = avgByTypes(completed, Set.of("MOCK", "TECHNICAL", "DSA_ORAL", "ROLE", "COMPANY", "PROJECT"));
        int hr = avgByTypes(completed, Set.of("HR"));
        int coding = avgByTypes(completed, Set.of("CODING"));
        int aptitude = avgByTypes(completed, Set.of("APTITUDE"));
        int dsa = avgByTypes(completed, Set.of("DSA_ORAL"));
        if (dsa == 0) {
            dsa = coding;
        }
        int resume = latestResumeScore(owner.getId());

        List<PlacementMessage> messages = new ArrayList<>();
        for (PlacementSession s : completed) {
            messages.addAll(messageRepository.findBySessionIdOrderByCreatedAtAsc(s.getId()));
        }
        int communication = avgAxis(messages, "communication");

        List<AnalyticsResponse.DateScore> daily = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            daily.add(new AnalyticsResponse.DateScore(d.toString(), avgScoreOnDate(completed, d)));
        }
        List<AnalyticsResponse.DateScore> weekly = new ArrayList<>();
        LocalDate currentMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for (int i = 3; i >= 0; i--) {
            LocalDate start = currentMonday.minusWeeks(i);
            LocalDate end = start.plusDays(7);
            int score = avgScoreBetween(completed, start, end);
            weekly.add(new AnalyticsResponse.DateScore(start.toString(), score));
        }
        List<AnalyticsResponse.DateScore> monthly = new ArrayList<>();
        LocalDate currentMonth = today.withDayOfMonth(1);
        for (int i = 5; i >= 0; i--) {
            LocalDate start = currentMonth.minusMonths(i);
            LocalDate end = start.plusMonths(1);
            int score = avgScoreBetween(completed, start, end);
            monthly.add(new AnalyticsResponse.DateScore(start.toString(), score));
        }

        int timeSpent = (int) messageRepository.countByOwnerIdAndRole(owner.getId(), "USER") * 3;
        int accuracy = aptitude > 0 ? aptitude : 0;
        int successRate = completed.isEmpty() ? 0
                : (int) Math.round(completed.stream().mapToInt(PlacementSession::getScore).average().orElse(0));

        Map<String, Integer> strongCounts = new HashMap<>();
        Map<String, Integer> weakCounts = new HashMap<>();
        collectTopicCounts(owner, weakCounts, strongCounts);
        List<String> strongTopics = topKeys(strongCounts, 3);
        List<String> weakTopics = topKeys(weakCounts, 3);
        AnalyzeResumeResponse.Analysis analysis = latestAnalysis(owner.getId());
        if (analysis != null) {
            if (strongTopics.isEmpty() && analysis.skills() != null) {
                strongTopics = analysis.skills().stream().limit(3).toList();
            }
            if (weakTopics.isEmpty() && analysis.missingSkills() != null) {
                weakTopics = analysis.missingSkills().stream().limit(3).toList();
            }
        }

        ReadinessResult readiness = computeReadiness(owner.getId(), resume);
        return new AnalyticsResponse(technical, hr, communication, coding, dsa, aptitude, resume,
                readiness.score(), daily, weekly, monthly, timeSpent, accuracy, successRate, strongTopics, weakTopics);    }

    // ------------------------------------------------------------------
    // Readiness / Roadmap
    // ------------------------------------------------------------------

    public ReadinessResponse getReadiness(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        int resumeScore = latestResumeScore(owner.getId());
        ReadinessResult readiness = computeReadiness(owner.getId(), resumeScore);
        int score = readiness.score();
        String label = readiness.label();

        List<ReadinessResponse.ComponentScore> components = List.of(
                new ReadinessResponse.ComponentScore("Resume", resumeScore, 25),
                new ReadinessResponse.ComponentScore("Technical Interviews", avgByTypes(owner.getId(), INTERVIEW_TYPES), 25),
                new ReadinessResponse.ComponentScore("Coding", avgByTypes(owner.getId(), Set.of("CODING")), 20),
                new ReadinessResponse.ComponentScore("Aptitude", avgByTypes(owner.getId(), Set.of("APTITUDE")), 15),
                new ReadinessResponse.ComponentScore("Communication", communicationScore(owner.getId()), 15));

        CacheEntry cached = readinessCache.get(ownerEmail);
        if (cached != null && Instant.now().isBefore(cached.until())) {
            ReadinessResponse.ReadinessAi aiPart = (ReadinessResponse.ReadinessAi) cached.body();
            return new ReadinessResponse(score, label, components,
                    nvl(aiPart.recommendedCompanies()), nvl(aiPart.recommendedRoles()), nvl(aiPart.learningPath()));
        }

        ReadinessResponse.ReadinessAi aiPart = ai.generateReadiness(buildProfileSummary(owner.getId()));
        readinessCache.put(ownerEmail, new CacheEntry(Instant.now().plusMillis(STRATEGY_CACHE_MS), aiPart));
        return new ReadinessResponse(score, label, components,
                nvl(aiPart.recommendedCompanies()), nvl(aiPart.recommendedRoles()), nvl(aiPart.learningPath()));
    }

    public RoadmapResponse getRoadmap(String ownerEmail) {
        User owner = resolveOwner(ownerEmail);
        CacheEntry cached = roadmapCache.get(ownerEmail);
        if (cached != null && Instant.now().isBefore(cached.until())) {
            return (RoadmapResponse) cached.body();
        }
        RoadmapResponse.RoadmapAi aiPart = ai.generateRoadmap(buildProfileSummary(owner.getId()));
        RoadmapResponse response = new RoadmapResponse(
                nvl(aiPart.weakTopics()), nvl(aiPart.dailyTasks()), nvl(aiPart.weeklyGoals()),
                nvl(aiPart.interviewSchedule()), nvl(aiPart.companyPreparation()),
                nvl(aiPart.resumeImprovements()), nvl(aiPart.codingRecommendations()),
                nvl(aiPart.dsaRevision()), nvl(aiPart.aptitudePractice()));
        roadmapCache.put(ownerEmail, new CacheEntry(Instant.now().plusMillis(STRATEGY_CACHE_MS), response));
        return response;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User resolveOwner(String ownerEmail) {
        return userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    private PlacementSession requireSession(String ownerEmail, String id) {
        User owner = resolveOwner(ownerEmail);
        return sessionRepository.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new BadRequestException("Session not found or access denied"));
    }

    private PlacementSessionDto toDto(PlacementSession s) {
        return new PlacementSessionDto(s.getId(), s.getType(), s.getMode(), s.getRole(), s.getCompany(),
                s.getDifficulty(), s.getTopic(), s.getStatus(), s.getScore(),
                (int) messageRepository.countBySessionId(s.getId()),
                s.getCreatedAt().toString(),
                s.getStartedAt() == null ? null : s.getStartedAt().toString(),
                s.getEndedAt() == null ? null : s.getEndedAt().toString());
    }

    private List<String> toHistoryLines(List<PlacementMessage> messages) {
        List<String> lines = new ArrayList<>();
        int start = Math.max(0, messages.size() - 16);
        for (int i = start; i < messages.size(); i++) {
            PlacementMessage m = messages.get(i);
            if (m.getContent() == null || m.getContent().isBlank()) {
                continue;
            }
            String prefix = "USER".equals(m.getRole()) ? "Candidate: " : "Interviewer: ";
            lines.add(prefix + m.getContent());
        }
        return lines;
    }

    private int latestResumeScore(String ownerId) {
        AnalyzeResumeResponse.Analysis analysis = latestAnalysis(ownerId);
        return analysis == null ? 0 : analysis.overallScore();
    }

    private AnalyzeResumeResponse.Analysis latestAnalysis(String ownerId) {
        Optional<PlacementResumeAnalysis> latest = analysisRepository.findTopByOwnerIdOrderByCreatedAtDesc(ownerId);
        return latest.map(a -> readJson(a.getAnalysisJson(), AnalyzeResumeResponse.Analysis.class)).orElse(null);
    }

    private int computeStreak(List<PlacementSession> sessions, LocalDate today) {
        Set<LocalDate> activeDays = sessions.stream()
                .map(s -> s.getCreatedAt().toLocalDate())
                .collect(Collectors.toSet());
        int streak = 0;
        LocalDate d = today;
        while (activeDays.contains(d)) {
            streak++;
            d = d.minusDays(1);
        }
        return streak;
    }

    private ReadinessResult computeReadiness(String ownerId, int resumeScore) {
        List<PlacementSession> completed = sessionRepository.findByOwnerIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()) && s.getScore() != null)
                .collect(Collectors.toList());
        int technical = avgScores(completed, INTERVIEW_TYPES);
        int coding = avgScores(completed, Set.of("CODING"));
        int aptitude = avgScores(completed, Set.of("APTITUDE"));
        int communication = communicationScore(ownerId);

        boolean hasData = resumeScore > 0 || technical > 0 || coding > 0 || aptitude > 0 || communication > 0;
        if (!hasData) {
            return new ReadinessResult(0, "Not Started");
        }
        double score = resumeScore * 0.25 + technical * 0.25 + coding * 0.20 + aptitude * 0.15 + communication * 0.15;
        int rounded = (int) Math.round(score);
        String label;
        if (rounded >= 80) {
            label = "Excellent";
        } else if (rounded >= 60) {
            label = "Good";
        } else if (rounded >= 40) {
            label = "Needs Improvement";
        } else {
            label = "Critical";
        }
        return new ReadinessResult(rounded, label);
    }

    private int avgByTypes(List<PlacementSession> completed, Set<String> types) {
        return avgScores(completed, types);
    }

    private int avgByTypes(String ownerId, Set<String> types) {
        List<PlacementSession> completed = sessionRepository.findByOwnerIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()) && s.getScore() != null)
                .collect(Collectors.toList());
        return avgScores(completed, types);
    }

    private int avgScores(List<PlacementSession> completed, Set<String> types) {
        List<PlacementSession> filtered = completed.stream()
                .filter(s -> types.contains(s.getType()) && s.getScore() != null)
                .collect(Collectors.toList());
        if (filtered.isEmpty()) {
            return 0;
        }
        return (int) Math.round(filtered.stream().mapToInt(PlacementSession::getScore).average().orElse(0));
    }

    private int communicationScore(String ownerId) {
        List<PlacementSession> sessions = sessionRepository.findByOwnerIdOrderByCreatedAtDesc(ownerId);
        List<PlacementMessage> messages = new ArrayList<>();
        for (PlacementSession s : sessions) {
            messages.addAll(messageRepository.findBySessionIdOrderByCreatedAtAsc(s.getId()));
        }
        return avgAxis(messages, "communication");
    }

    private int avgAxis(List<PlacementMessage> messages, String axis) {
        List<Integer> values = new ArrayList<>();
        for (PlacementMessage m : messages) {
            if (m.getAnalysisJson() == null) {
                continue;
            }
            InterviewFeedback fb = readAnalysis(m.getAnalysisJson());
            if (fb != null && fb.scores() != null && fb.scores().get(axis) != null) {
                values.add(fb.scores().get(axis));
            }
        }
        if (values.isEmpty()) {
            return 0;
        }
        return (int) Math.round(values.stream().mapToInt(Integer::intValue).average().orElse(0));
    }

    private void collectTopicCounts(User owner, Map<String, Integer> weak, Map<String, Integer> strong) {
        List<PlacementSession> sessions = sessionRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId());
        for (PlacementSession s : sessions) {
            for (PlacementMessage m : messageRepository.findBySessionIdOrderByCreatedAtAsc(s.getId())) {
                if (m.getAnalysisJson() == null) {
                    continue;
                }
                InterviewFeedback fb = readAnalysis(m.getAnalysisJson());
                if (fb == null) {
                    continue;
                }
                if (fb.weaknesses() != null) {
                    for (String w : fb.weaknesses()) {
                        weak.merge(shorten(w), 1, Integer::sum);
                    }
                }
                if (fb.strengths() != null) {
                    for (String st : fb.strengths()) {
                        strong.merge(shorten(st), 1, Integer::sum);
                    }
                }
            }
        }
    }

    private String shorten(String s) {
        if (s == null) {
            return "";
        }
        return s.length() <= 60 ? s : s.substring(0, 60);
    }

    private List<String> topKeys(Map<String, Integer> counts, int limit) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(limit)
                .map(Map.Entry::getKey)
                .filter(k -> !k.isBlank())
                .collect(Collectors.toList());
    }

    private int avgScoreOnDate(List<PlacementSession> completed, LocalDate date) {
        List<PlacementSession> daySessions = completed.stream()
                .filter(s -> s.getScore() != null && s.getCreatedAt().toLocalDate().equals(date))
                .collect(Collectors.toList());
        if (daySessions.isEmpty()) {
            return 0;
        }
        return (int) Math.round(daySessions.stream().mapToInt(PlacementSession::getScore).average().orElse(0));
    }

    private int avgScoreBetween(List<PlacementSession> completed, LocalDate start, LocalDate end) {
        List<PlacementSession> range = completed.stream()
                .filter(s -> s.getScore() != null && s.getCreatedAt().toLocalDate().isAfter(start.minusDays(1))
                        && s.getCreatedAt().toLocalDate().isBefore(end))
                .collect(Collectors.toList());
        if (range.isEmpty()) {
            return 0;
        }
        return (int) Math.round(range.stream().mapToInt(PlacementSession::getScore).average().orElse(0));
    }

    private List<String> usedAptitudeQuestions(String ownerId) {
        List<String> used = new ArrayList<>();
        for (PlacementSession s : sessionRepository.findByOwnerIdOrderByCreatedAtDesc(ownerId)) {
            if (!"APTITUDE".equals(s.getType()) || s.getPayloadJson() == null) {
                continue;
            }
            AptitudeTestDto test = readJson(s.getPayloadJson(), AptitudeTestDto.class);
            if (test != null && test.questions() != null) {
                for (AptitudeTestDto.Question q : test.questions()) {
                    if (q.text() != null && !q.text().isBlank()) {
                        used.add(q.text());
                    }
                }
            }
        }
        return used;
    }

    private List<String> usedCodingTitles(String ownerId) {
        List<String> used = new ArrayList<>();
        for (PlacementSession s : sessionRepository.findByOwnerIdOrderByCreatedAtDesc(ownerId)) {
            if (!"CODING".equals(s.getType()) || s.getPayloadJson() == null) {
                continue;
            }
            CodingProblem problem = readJson(s.getPayloadJson(), CodingProblem.class);
            if (problem != null && problem.title() != null && !problem.title().isBlank()) {
                used.add(problem.title());
            }
        }
        return used;
    }

    private String buildProfileSummary(String ownerId) {
        StringBuilder sb = new StringBuilder();
        AnalyzeResumeResponse.Analysis analysis = latestAnalysis(ownerId);
        sb.append("Candidate profile:\n");
        sb.append("- resume overall score: ").append(latestResumeScore(ownerId)).append("/100\n");
        if (analysis != null) {
            sb.append("- skills: ").append(analysis.skills() == null ? "-" : String.join(", ", analysis.skills())).append("\n");
            sb.append("- missing skills: ").append(analysis.missingSkills() == null ? "-" : String.join(", ", analysis.missingSkills())).append("\n");
        }
        sb.append("- avg technical interview score: ").append(avgByTypes(ownerId, Set.of("MOCK", "TECHNICAL", "DSA_ORAL", "ROLE", "COMPANY", "PROJECT"))).append("/100\n");
        sb.append("- avg coding score: ").append(avgByTypes(ownerId, Set.of("CODING"))).append("/100\n");
        sb.append("- avg aptitude score: ").append(avgByTypes(ownerId, Set.of("APTITUDE"))).append("/100\n");
        return sb.toString();
    }

    private <T> List<T> nvl(List<T> list) {
        return list == null ? List.of() : list;
    }

    private String writeJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Failed to serialize data: " + safeMessage(e));
        }
    }

    private <T> T readJson(String json, Class<T> type) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, type);
        } catch (IOException e) {
            log.warn("Failed to parse stored payload: {}", safeMessage(e));
            return null;
        }
    }

    private InterviewFeedback readAnalysis(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, InterviewFeedback.class);
        } catch (IOException e) {
            log.warn("Failed to parse message analysis: {}", safeMessage(e));
            return null;
        }
    }

    private static String safeMessage(Throwable t) {
        return t == null || t.getMessage() == null ? "unknown error" : t.getMessage();
    }
}
