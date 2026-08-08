CREATE TABLE placement_resumes (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_placement_resumes PRIMARY KEY (id),
    CONSTRAINT fk_placement_resume_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_placement_resume_owner ON placement_resumes (owner_id);

CREATE TABLE placement_resume_analyses (
    id VARCHAR(36) NOT NULL,
    resume_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    analysis_json TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_placement_resume_analyses PRIMARY KEY (id),
    CONSTRAINT fk_placement_analysis_resume FOREIGN KEY (resume_id) REFERENCES placement_resumes (id) ON DELETE CASCADE,
    CONSTRAINT fk_placement_analysis_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_placement_analysis_owner ON placement_resume_analyses (owner_id);

CREATE TABLE placement_sessions (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    type VARCHAR(30) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'AI',
    role VARCHAR(100),
    company VARCHAR(100),
    difficulty VARCHAR(20),
    topic VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    score INT NULL,
    payload_json TEXT,
    summary TEXT,
    started_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_placement_sessions PRIMARY KEY (id),
    CONSTRAINT fk_placement_session_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_placement_session_owner_created ON placement_sessions (owner_id, created_at);

CREATE TABLE placement_messages (
    id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    analysis_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_placement_messages PRIMARY KEY (id),
    CONSTRAINT fk_placement_message_session FOREIGN KEY (session_id) REFERENCES placement_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_placement_message_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_placement_message_session ON placement_messages (session_id);
