package com.careeros.ai;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.context.annotation.Profile;

@Component
@Profile("ai-test")
@RequiredArgsConstructor
@Slf4j
public class AITestRunner implements CommandLineRunner {

    private final AIService aiService;
    private final AITaskRouter taskRouter;

    @Override
    public void run(String... args) throws Exception {
        log.info("========== STARTING REAL AI METRICS TESTS ==========");
        
        try {
            testTask(AITask.RESUME_ANALYSIS, "Extract skills from this resume: John Doe, Java Developer with 5 years experience in Spring Boot and PostgreSQL.", true);
            testTask(AITask.PLACEMENT_READINESS, "Assess readiness for a software engineer role based on these skills: Java, Spring Boot, React.", true);
            testTask(AITask.PLACEMENT_ROADMAP, "Create a 3-month roadmap for a beginner learning Python and Data Science.", true);
            testTask(AITask.CODING_ASSISTANCE, "Write a Java function to reverse a string.", false);
            testTask(AITask.INTERVIEW_ASSISTANCE, "Ask me a behavioral interview question.", false);
            testTask(AITask.APTITUDE_GENERATION, "Generate a multiple choice question about Java concurrency.", true);
            testTask(AITask.GENERAL_CHAT, "Hello! Who are you?", false);
        } catch (Exception e) {
            log.error("Test suite failed", e);
        }
        
        log.info("========== FINISHED AI METRICS TESTS ==========");
        taskRouter.dumpMetrics();
    }
    
    private void testTask(AITask task, String prompt, boolean json) {
        log.info("--- Testing {} ---", task);
        try {
            String result = aiService.generate(task, "You are a helpful assistant.", prompt, 0.7, 500, json);
            log.info("Test SUCCESS for {}. Output length: {}", task, result != null ? result.length() : 0);
        } catch (Exception e) {
            log.error("Test FAILED for {}", task, e);
        }
    }
}
