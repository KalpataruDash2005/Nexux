package com.careeros.placement.service;

import com.careeros.exception.BadRequestException;
import com.careeros.placement.config.PlacementProperties;
import com.careeros.placement.dto.AnalyzeResumeResponse;
import com.careeros.placement.dto.AptitudeTestDto;
import com.careeros.placement.dto.CodingEvaluation;
import com.careeros.placement.dto.CodingProblem;
import com.careeros.placement.dto.InterviewFeedback;
import com.careeros.placement.dto.ReadinessResponse;
import com.careeros.placement.dto.RoadmapResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class PlacementAiService {

    private static final int LLM_MAX_RETRIES = 5;
    private static final int JSON_MAX_ATTEMPTS = 3;

    private final PlacementProperties props;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public PlacementAiService(PlacementProperties props, RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.props = props;
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    public String chat(String system, String user, double temperature, int maxTokens) {
        return postCompletion(body(system, user, temperature, maxTokens, false));
    }

    public <T> T chatJson(String system, String user, Class<T> type) {
        return chatJson(system, user, type, 0.2);
    }

    public <T> T chatJson(String system, String user, Class<T> type, double temperature) {
        String current = user;
        for (int attempt = 1; attempt <= JSON_MAX_ATTEMPTS; attempt++) {
            String raw = postCompletion(body(system, current, temperature, 2048, true));
            try {
                return objectMapper.readValue(cleanJson(raw), type);
            } catch (Exception e) {
                log.warn("Placement AI JSON parse failed (attempt {}/{}): {}", attempt, JSON_MAX_ATTEMPTS, safeMessage(e));
                current = user + "\n\nYour previous response was not valid JSON. Reply with ONLY valid JSON matching the requested schema. No prose, no code fences.";
            }
        }
        throw new BadRequestException("AI returned invalid JSON after " + JSON_MAX_ATTEMPTS + " attempts");
    }

    // ------------------------------------------------------------------
    // Prompt builders
    // ------------------------------------------------------------------

    public AnalyzeResumeResponse.Analysis analyzeResumeText(String text) {
        String user = "Here is the full text of a candidate's resume:\n\n\"" + truncate(text, 12000) + "\"\n\n" +
                "Analyze this resume and return a JSON object with EXACTLY these fields:\n" +
                "- candidateName: string (from the resume header; empty string if not found)\n" +
                "- atsScore: integer 0-100 (how well it would pass ATS keyword/section parsing)\n" +
                "- overallScore: integer 0-100\n" +
                "- categoryScores: object with keys formatting, sections, grammar, actionVerbs, keywords, achievements, atsCompatibility; each 0-100\n" +
                "- skills: array of strings (ONLY skills actually present in or directly implied by the text)\n" +
                "- missingSkills: array of strings (high-demand skills absent from the resume; max 6)\n" +
                "- strengths: array of strings (max 5)\n" +
                "- weaknesses: array of strings (max 5)\n" +
                "- suggestions: array of objects {line, suggestion} (specific line-level fixes, max 6)\n" +
                "- rewrittenBullets: array of objects {original, rewritten} (improve weak bullet points, max 4)\n" +
                "- sections: array of strings (section headings found, e.g. Education, Experience, Skills)\n" +
                "- projects: array of objects {title, description, technologies[], highlights[]} (max 5; only from text)\n" +
                "- education: array of objects {degree, institution, duration, percentage} (only from text)\n" +
                "- experience: array of objects {company, role, duration, highlights[]} (only from text)\n" +
                "- expectedQuestions: array of strings (questions an interviewer would ask based on this resume, max 6)\n" +
                "- recommendedProjects: array of strings (max 3)\n" +
                "- recommendedCertifications: array of strings (max 3)\n" +
                "- checklist: array of strings (max 8 actionable resume fixes)\n" +
                "IMPORTANT: Never invent experience, companies, degrees, or skills not present in or directly implied by the text. " +
                "If a section is missing, return an empty array. Return ONLY valid JSON.";
        return chatJson(resumeSystem(), user, AnalyzeResumeResponse.Analysis.class);
    }

    public String firstQuestion(String type, String role, String company, String difficulty, String resumeText) {
        String system = interviewSystem(type, role, company, difficulty, resumeText);
        String user = "Begin the interview. Ask exactly ONE opening question appropriate for a " + type + " interview" +
                (role == null || role.isBlank() ? "" : " for the role of " + role) +
                (company == null || company.isBlank() ? "" : " at " + company) +
                " at " + (difficulty == null || difficulty.isBlank() ? "MEDIUM" : difficulty) + " difficulty." +
                " If a resume was provided and the type is PROJECT, ask about the strongest project on the resume. " +
                "Output ONLY the question text, with no preamble, no numbering, no extra text.";
        return chat(system, user, 0.7, 1024);
    }

    public InterviewFeedback evaluateAnswer(String type, String role, String company, String difficulty, List<String> historyLines, String latestAnswer) {
        String system = interviewSystem(type, role, company, difficulty, null);
        StringBuilder user = new StringBuilder();
        if (historyLines != null && !historyLines.isEmpty()) {
            user.append("Conversation so far:\n");
            for (String line : historyLines) {
                user.append(line).append("\n");
            }
        }
        user.append("\nThe candidate just answered the latest question with this response:\n\"").append(truncate(latestAnswer, 4000)).append("\"\n\n");
        user.append("Evaluate this answer and return ONLY valid JSON with EXACTLY these fields:\n")
                .append("- score: integer 0-100 overall\n")
                .append("- scores: object with keys confidence, communication, grammar, technicalAccuracy, structure, completeness (each 0-100)\n")
                .append("- strengths: array of strings (max 3)\n")
                .append("- weaknesses: array of strings (max 3)\n")
                .append("- improvementTips: array of strings (max 3, actionable)\n")
                .append("- idealAnswer: string (a concise model answer, 2-4 sentences; empty string if the answer was essentially correct)\n")
                .append("- nextQuestion: string (the next single interview question that builds on this answer; empty string if interview should end)\n")
                .append("- nextDifficulty: string EASY|MEDIUM|HARD (adapt to performance)\n")
                .append("- questionCount: integer (the number of questions asked so far including this one)\n")
                .append("- shouldEnd: boolean (true if the interview should conclude now, e.g. 8+ questions asked, or the answer clearly closes the topic)\n")
                .append("- finalSummary: string (ONLY when shouldEnd is true: a 2-3 sentence overall assessment; otherwise empty string)\n");
        return chatJson(system, user.toString(), InterviewFeedback.class);
    }

    public CodingProblem generateCodingProblem(String role, String topic, String difficulty, List<String> usedTitles) {
        String user = "Generate a well-known, unambiguous coding interview problem for a " + (role == null || role.isBlank() ? "Software" : role) +
                " role, topic \"" + (topic == null || topic.isBlank() ? "Arrays" : topic) + "\", difficulty " + (difficulty == null || difficulty.isBlank() ? "MEDIUM" : difficulty) + ".\n" +
                "Variety rule: the candidate already solved these problems before — pick a DIFFERENT well-known problem and do NOT reuse any of these or near-variants of them:\n" +
                avoidList(usedTitles, 20) + "\n" +
                "Return ONLY valid JSON with EXACTLY these fields:\n" +
                "- title: string\n" +
                "- statement: string (clear problem statement with input/output format and constraints stated in prose)\n" +
                "- examples: array of objects {input, output} (2-3 examples, input shows sample values)\n" +
                "- constraints: string\n" +
                "- difficulty: string EASY|MEDIUM|HARD\n" +
                "- topics: array of strings (max 3)\n" +
                "The problem must be a real, solvable problem (e.g. Two Sum, Merge Intervals). No ambiguity. Return ONLY the JSON.";
        return chatJson(codingSystem(), user, CodingProblem.class, 0.8);
    }

    public CodingEvaluation evaluateCode(CodingProblem problem, String language, String code) {
        String user = "Evaluate this candidate's solution.\n\nProblem:\nTitle: " + problem.title() +
                "\nStatement: " + problem.statement() + "\nExamples: " + problem.examples() + "\nConstraints: " + problem.constraints() +
                "\n\nLanguage: " + language + "\n\nCandidate code:\n```\n" + truncate(code, 8000) + "\n```\n\n" +
                "You cannot execute the code. Reason carefully about correctness (edge cases, index handling, base cases), complexity, and style. Return ONLY valid JSON with EXACTLY these fields:\n" +
                "- correctness: integer 0-100 (correctness for typical + edge cases; 100 only if clearly correct)\n" +
                "- timeComplexity: string (Big-O)\n" +
                "- spaceComplexity: string (Big-O)\n" +
                "- codeQuality: integer 0-100\n" +
                "- naming: integer 0-100\n" +
                "- optimization: integer 0-100\n" +
                "- feedback: string (2-4 sentences, specific)\n" +
                "- alternativeSolutions: array of strings (max 3)\n" +
                "- expectedQuestions: array of strings (max 3 follow-up questions)\n" +
                "Return ONLY the JSON.";
        return chatJson(codingSystem(), user, CodingEvaluation.class);
    }

    public AptitudeTestDto generateAptitudeTest(String category, String difficulty, int count, List<String> usedQuestions) {
        String user = "Generate " + count + " aptitude questions for a campus placement test. Category: " + category +
                " (QUANTITATIVE, LOGICAL, VERBAL, PUZZLE, or DI=data interpretation), difficulty " + (difficulty == null || difficulty.isBlank() ? "MEDIUM" : difficulty) + ".\n" +
                "Variety rules:\n" +
                "- The candidate already attempted these questions in previous tests — do NOT reuse any of them or direct variants (same numbers or wording):\n" +
                avoidList(usedQuestions, 30) + "\n" +
                "- Every question in this batch must be different from every other question in the batch (no duplicates).\n" +
                "- Vary the problem style and sub-topic within the category on every run.\n" +
                "Return ONLY valid JSON with EXACTLY this structure:\n" +
                "{\"questions\":[{\"id\":\"q1\",\"text\":\"question text\",\"options\":[\"A. ...\",\"B. ...\",\"C. ...\",\"D. ...\"],\"correctAnswerIndex\":0,\"explanation\":\"short explanation\",\"shortcut\":\"shortcut/trick if any\",\"difficulty\":\"EASY\",\"companyFrequency\":\"TCS, Infosys\"}, ...]}\n" +
                "Rules: every question must have exactly 4 distinct options, correctAnswerIndex must be 0-3, and every question must be genuinely solvable (correct math/logic/verbal reasoning). Mix in a few moderately tricky ones. Return ONLY the JSON.";
        AptitudeTestDto dto = chatJson(aptitudeSystem(), user, AptitudeTestDto.class, 0.9);
        if (dto == null || dto.questions() == null || dto.questions().isEmpty()) {
            throw new BadRequestException("Could not generate a valid aptitude test, please retry.");
        }
        Set<String> used = new HashSet<>();
        if (usedQuestions != null) {
            for (String u : usedQuestions) {
                used.add(normalize(u));
            }
        }
        List<AptitudeTestDto.Question> valid = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (AptitudeTestDto.Question q : dto.questions()) {
            if (q.options() != null && q.options().size() == 4
                    && q.correctAnswerIndex() != null && q.correctAnswerIndex() >= 0 && q.correctAnswerIndex() <= 3) {
                String key = normalize(q.text());
                if (used.contains(key) || seen.contains(key)) {
                    continue;
                }
                seen.add(key);
                valid.add(q);
            }
        }
        if (valid.isEmpty() || valid.size() < count / 2) {
            throw new BadRequestException("AI produced too few valid aptitude questions, please retry.");
        }
        return new AptitudeTestDto(valid);
    }

    public ReadinessResponse.ReadinessAi generateReadiness(String profileSummary) {
        String user = "Based on this candidate profile summary:\n\"" + profileSummary + "\"\n\n" +
                "Return ONLY valid JSON with EXACTLY these fields:\n" +
                "- recommendedCompanies: array of strings (companies that best fit this profile, max 5)\n" +
                "- recommendedRoles: array of strings (roles to target, max 5)\n" +
                "- learningPath: array of objects {topic, resources[] (max 3), estimatedHours (number), priority (HIGH|MEDIUM|LOW)} (max 6 items, most impactful first)\n" +
                "Base recommendations ONLY on the provided profile. Return ONLY the JSON.";
        return chatJson(strategySystem(), user, ReadinessResponse.ReadinessAi.class);
    }

    public RoadmapResponse.RoadmapAi generateRoadmap(String profileSummary) {
        String user = "Based on this candidate profile summary:\n\"" + profileSummary + "\"\n\n" +
                "Return ONLY valid JSON with EXACTLY these fields:\n" +
                "- weakTopics: array of strings (max 6)\n" +
                "- dailyTasks: array of strings (a focused 2-week daily practice plan, max 7 tasks)\n" +
                "- weeklyGoals: array of strings (max 5)\n" +
                "- interviewSchedule: array of strings (a mock interview cadence, max 5 entries)\n" +
                "- companyPreparation: array of objects {company, notes} (max 4)\n" +
                "- resumeImprovements: array of strings (max 5)\n" +
                "- codingRecommendations: array of strings (max 5)\n" +
                "- dsaRevision: array of strings (max 5)\n" +
                "- aptitudePractice: array of strings (max 5)\n" +
                "Be concrete and actionable. Return ONLY the JSON.";
        return chatJson(strategySystem(), user, RoadmapResponse.RoadmapAi.class);
    }

    // ------------------------------------------------------------------
    // System prompts
    // ------------------------------------------------------------------

    private String resumeSystem() {
        return "You are an expert ATS resume parser and career coach for campus placement preparation. " +
                "You output strictly valid JSON (no markdown). You never invent facts about the candidate. " +
                "Be specific, concise, and constructive in all feedback.";
    }

    private String interviewSystem(String type, String role, String company, String difficulty, String resumeText) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a strict, professional campus placement interviewer");
        if (company != null && !company.isBlank()) {
            sb.append(" at ").append(company);
        }
        if (role != null && !role.isBlank()) {
            sb.append(" interviewing for the role of ").append(role);
        }
        sb.append(". You are conducting a ").append(type)
                .append(" interview at ").append(difficulty == null || difficulty.isBlank() ? "MEDIUM" : difficulty)
                .append(" difficulty.\n");
        sb.append("Interview types: MOCK=general mock, TECHNICAL=core CS and role tech stack, DSA_ORAL=data structures and algorithms, ")
                .append("HR=HR round, BEHAVIORAL=behavioral (use STAR), PROJECT=deep dive into a resume project, ")
                .append("COMPANY=company-specific questions, ROLE=role-specific depth.\n");
        if (resumeText != null && !resumeText.isBlank()) {
            sb.append("The candidate's resume:\n\"").append(truncate(resumeText, 6000)).append("\"\n");
        }
        sb.append("Rules: Ask ONE question at a time. Build naturally on the candidate's previous answers. ")
                .append("For BEHAVIORAL/HR use the STAR method. Never reveal ideal answers. Never output JSON. Be professional and slightly challenging.");
        return sb.toString();
    }

    private String codingSystem() {
        return "You are a senior software engineer and DSA interviewer evaluating candidates' code. " +
                "You output strictly valid JSON (no markdown). You are fair, specific, and constructive. You never run code; you reason about it.";
    }

    private String aptitudeSystem() {
        return "You are an aptitude test setter for campus placement exams. You output strictly valid JSON (no markdown). " +
                "Every question is solvable and unambiguous, with exactly 4 distinct options and a correct 0-based index.";
    }

    private String strategySystem() {
        return "You are a campus placement strategy coach. You give concrete, realistic, prioritized advice. " +
                "You output strictly valid JSON (no markdown). You never invent facts about the candidate; use only the provided profile summary.";
    }

    // ------------------------------------------------------------------
    // LLM plumbing
    // ------------------------------------------------------------------

    private Map<String, Object> body(String system, String user, double temperature, int maxTokens, boolean jsonMode) {
        List<Map<String, Object>> messages = new ArrayList<>();
        Map<String, Object> sys = new LinkedHashMap<>();
        sys.put("role", "system");
        sys.put("content", system);
        messages.add(sys);
        Map<String, Object> usr = new LinkedHashMap<>();
        usr.put("role", "user");
        usr.put("content", user);
        messages.add(usr);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.getLlmModel());
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }
        body.put("messages", messages);
        return body;
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
                    throw new BadRequestException("AI call failed: " + safeMessage(e));
                }
                long waitMs = retryDelayMs(msg, attempt);
                log.warn("Placement AI rate limited (attempt {}), retrying in {} ms", attempt, waitMs);
                try {
                    Thread.sleep(waitMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new BadRequestException("Interrupted while waiting to retry AI call");
                }
            }
        }
        throw new BadRequestException("AI call failed after retries: " + safeMessage(lastError));
    }

    private long retryDelayMs(String message, int attempt) {
        Matcher m = Pattern.compile("try again in (\\d+(?:\\.\\d+)?)\\s*s")
                .matcher(message == null ? "" : message);
        if (m.find()) {
            long seconds = (long) Math.ceil(Double.parseDouble(m.group(1)));
            if (seconds >= 1 && seconds <= 120) {
                return seconds * 1000L;
            }
        }
        return Math.min(4000L * (1L << (attempt - 1)), 60000L);
    }

    private String cleanJson(String raw) {        if (raw == null) {
            return "{}";
        }
        String s = raw.trim();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) {
                s = s.substring(nl + 1);
            }
            s = s.replaceAll("```\\s*$", "").trim();
        }
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return s.substring(start, end + 1);
        }
        return s;
    }

    private String safeMessage(Throwable t) {
        if (t == null) {
            return "unknown error";
        }
        String m = t.getMessage();
        return m == null ? t.getClass().getSimpleName() : m;
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String avoidList(List<String> items, int max) {
        if (items == null || items.isEmpty()) {
            return "  (none recorded)";
        }
        List<String> slice = items.size() > max ? items.subList(items.size() - max, items.size()) : items;
        StringBuilder sb = new StringBuilder("  - ");
        sb.append(String.join("\n  - ", slice));
        return sb.toString();
    }

    private String normalize(String s) {
        if (s == null) {
            return "";
        }
        return s.toLowerCase().replaceAll("\\s+", " ").trim();
    }
}
