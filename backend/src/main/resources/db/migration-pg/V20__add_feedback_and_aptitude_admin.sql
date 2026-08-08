CREATE TABLE feedback_submissions (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_feedback_submissions PRIMARY KEY (id)
);

CREATE INDEX idx_feedback_submissions_status ON feedback_submissions (status);
CREATE INDEX idx_feedback_submissions_created ON feedback_submissions (created_at);

CREATE TABLE aptitude_sets (
    id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255),
    question_count INT NOT NULL DEFAULT 0,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_aptitude_sets PRIMARY KEY (id)
);

CREATE INDEX idx_aptitude_sets_created ON aptitude_sets (created_at);

CREATE TABLE aptitude_questions (
    id VARCHAR(36) NOT NULL,
    set_id VARCHAR(36) NOT NULL,
    text TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_index INT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20),
    topic VARCHAR(100),
    category VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_aptitude_questions PRIMARY KEY (id),
    CONSTRAINT fk_aptitude_question_set FOREIGN KEY (set_id) REFERENCES aptitude_sets (id) ON DELETE CASCADE
);

CREATE INDEX idx_aptitude_question_set ON aptitude_questions (set_id);
