CREATE TABLE academic_events (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    color VARCHAR(20),
    location VARCHAR(255),
    semester VARCHAR(100),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    needs_verification BOOLEAN NOT NULL DEFAULT FALSE,
    ai_confidence DOUBLE NULL,
    source_file VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_academic_events PRIMARY KEY (id),
    CONSTRAINT fk_academic_event_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_academic_events_owner_date (owner_id, event_date),
    INDEX idx_academic_events_owner_category (owner_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE planner_study_items (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    plan_date DATE NOT NULL,
    start_time TIME NULL,
    subject VARCHAR(255) NOT NULL,
    hours DOUBLE NOT NULL DEFAULT 1,
    session_type VARCHAR(50) NOT NULL DEFAULT 'STUDY',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_planner_study_items PRIMARY KEY (id),
    CONSTRAINT fk_planner_study_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_planner_study_owner_date (owner_id, plan_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
