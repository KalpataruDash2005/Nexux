ALTER TABLE tasks
    ADD COLUMN estimated_hours DECIMAL(5,2) NULL,
    ADD COLUMN remaining_hours DECIMAL(5,2) NULL,
    ADD COLUMN chunk_index INT NULL,
    ADD COLUMN total_chunks INT NULL,
    ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN started_at TIMESTAMP NULL,
    ADD COLUMN paused_at TIMESTAMP NULL,
    ADD COLUMN completed_at TIMESTAMP NULL,
    ADD COLUMN last_activity TIMESTAMP NULL;

CREATE TABLE ai_conversations (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    task_id VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_ai_conversations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_conversations_user_created ON ai_conversations (user_id, created_at);

CREATE TABLE ai_memory (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    mem_key VARCHAR(64) NOT NULL,
    mem_value VARCHAR(500) NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_ai_memory_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_ai_memory_user_key UNIQUE (user_id, mem_key)
);
