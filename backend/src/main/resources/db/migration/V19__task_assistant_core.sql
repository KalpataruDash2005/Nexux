-- Smart AI Task Assistant: chunk metadata + conversation memory + preference memory
ALTER TABLE tasks
    ADD COLUMN estimated_hours DECIMAL(5,2) NULL AFTER deadline,
    ADD COLUMN remaining_hours DECIMAL(5,2) NULL AFTER estimated_hours,
    ADD COLUMN chunk_index INT NULL AFTER remaining_hours,
    ADD COLUMN total_chunks INT NULL AFTER chunk_index,
    ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT FALSE AFTER total_chunks,
    ADD COLUMN started_at DATETIME NULL AFTER ai_generated,
    ADD COLUMN paused_at DATETIME NULL AFTER started_at,
    ADD COLUMN completed_at DATETIME NULL AFTER paused_at,
    ADD COLUMN last_activity DATETIME NULL AFTER completed_at;

CREATE TABLE ai_conversations (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    task_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_ai_conversations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_ai_conversations_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_memory (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    mem_key VARCHAR(64) NOT NULL,
    mem_value VARCHAR(500) NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_ai_memory_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE KEY uq_ai_memory_user_key (user_id, mem_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
