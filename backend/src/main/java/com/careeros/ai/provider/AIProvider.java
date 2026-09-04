package com.careeros.ai.provider;

public interface AIProvider {
    String getName();
    boolean isAvailable();
    String generate(String model, String systemPrompt, String userPrompt, double temperature, int maxTokens, boolean jsonMode);
}
