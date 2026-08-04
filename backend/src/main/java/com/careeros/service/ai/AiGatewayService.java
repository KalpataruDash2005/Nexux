package com.careeros.service.ai;

import java.util.Map;

public interface AiGatewayService {

    /**
     * Sends a request to the LLM and streams the response back token by token.
     * Useful for chat and real-time interaction.
     */
    void streamResponse(String featureName, Map<String, Object> variables, java.util.function.Consumer<String> tokenConsumer, Runnable onComplete, java.util.function.Consumer<Throwable> onError);

    /**
     * Sends a request to the LLM and blocks until the full response is ready.
     * Parses the response as JSON. Useful for Quizzes, Flashcards, Summaries.
     */
    String generateStructured(String featureName, Map<String, Object> variables);
    
    /**
     * Simple blocking generation.
     */
    String generate(String featureName, Map<String, Object> variables);
}
