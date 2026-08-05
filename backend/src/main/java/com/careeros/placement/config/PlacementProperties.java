package com.careeros.placement.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Getter
public class PlacementProperties {

    @Value("${app.openai.api-key:}")
    private String llmApiKey;

    @Value("${app.openai.base-url:https://api.groq.com/openai/v1}")
    private String llmBaseUrl;

    @Value("${app.openai.model:llama-3.1-8b-instant}")
    private String llmModel;
}
