package com.careeros.planner.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Getter
public class PlannerProperties {

    @Value("${app.openai.api-key:}")
    private String llmApiKey;

    @Value("${app.openai.base-url:https://api.groq.com/openai/v1}")
    private String llmBaseUrl;

    @Value("${app.openai.model:llama-3.1-8b-instant}")
    private String llmModel;

    @Value("${app.planner.vision-model:llama-3.2-11b-vision-preview}")
    private String visionModel;

    @Value("${app.planner.storage-dir:./storage/planner}")
    private String storageDir;

    @Value("${app.planner.max-file-size:20971520}")
    private long maxFileSize;

    @Value("${app.planner.default-plan-days:14}")
    private int defaultPlanDays;

    @Value("${app.planner.min-confidence:0.6}")
    private double minConfidence;
}
