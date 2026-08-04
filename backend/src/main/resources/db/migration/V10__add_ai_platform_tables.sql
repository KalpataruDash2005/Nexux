CREATE TABLE ai_prompts (
    id VARCHAR(36) NOT NULL,
    feature_name VARCHAR(100) NOT NULL, -- e.g., QUIZ_GEN, FLASHCARD_GEN, CHAT
    version INT NOT NULL DEFAULT 1,
    template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_ai_prompts PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_usage_logs (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36),
    user_id VARCHAR(36),
    feature_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- e.g., GROQ, OPENAI
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    latency_ms BIGINT,
    is_error BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_ai_usage_logs PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_cache (
    cache_key VARCHAR(255) NOT NULL, -- hash of prompt + context
    response TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    CONSTRAINT pk_ai_cache PRIMARY KEY (cache_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default prompts
INSERT INTO ai_prompts (id, feature_name, version, template, is_active) VALUES 
('p-chat-1', 'CHAT', 1, 'You are an academic tutor. Context: {{context}}. Question: {{question}}', TRUE),
('p-flash-1', 'FLASHCARD_GEN', 1, 'Generate exactly {{count}} flashcards. JSON array only. Context: {{context}}', TRUE),
('p-quiz-1', 'QUIZ_GEN', 1, 'Generate exactly {{count}} {{difficulty}} questions. JSON array only. Context: {{context}}', TRUE),
('p-sum-1', 'SUMMARY_GEN', 1, 'Summarize the text. {{instruction}} Context: {{context}}', TRUE);
