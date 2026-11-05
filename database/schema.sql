-- ==============================================================
-- NEXUX / CareerOS — Consolidated PostgreSQL Schema (V1-V20)
-- ==============================================================


-- >>> V1__create_users_table.sql <<<
CREATE TABLE users (
    id VARCHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email)
);


-- >>> V2__create_student_profiles_table.sql <<<
CREATE TABLE student_profiles (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    university VARCHAR(255),
    degree VARCHAR(100),
    graduation_year INT,
    skills TEXT,
    resume_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_student_profiles PRIMARY KEY (id),
    CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_student_profiles_user UNIQUE (user_id)
);


-- >>> V3__create_jobs_table.sql <<<
CREATE TABLE jobs (
    id VARCHAR(36) NOT NULL,
    posted_by_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    salary VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_jobs PRIMARY KEY (id),
    CONSTRAINT fk_jobs_user FOREIGN KEY (posted_by_id) REFERENCES users(id) ON DELETE CASCADE
);


-- >>> V4__create_applications_table.sql <<<
CREATE TABLE applications (
    id VARCHAR(36) NOT NULL,
    job_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_applications PRIMARY KEY (id),
    CONSTRAINT fk_applications_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_applications_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_applications_job_student UNIQUE (job_id, student_id)
);


-- >>> V5__create_workspaces_table.sql <<<
CREATE TABLE workspaces (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_workspaces PRIMARY KEY (id),
    CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);


-- >>> V6__create_documents_table.sql <<<
CREATE TABLE documents (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    size_bytes BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_documents PRIMARY KEY (id),
    CONSTRAINT fk_documents_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);


-- >>> V7__add_document_metadata.sql <<<
ALTER TABLE documents
ADD COLUMN pages INT DEFAULT NULL,
ADD COLUMN language VARCHAR(50) DEFAULT NULL,
ADD COLUMN processing_time_ms BIGINT DEFAULT NULL,
ADD COLUMN chunk_count INT DEFAULT NULL;


-- >>> V8__add_study_tools_tables.sql <<<
CREATE TABLE summaries (
    id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_summaries PRIMARY KEY (id),
    CONSTRAINT fk_summaries_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

CREATE TABLE flashcards (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    document_id VARCHAR(36),
    page_number INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_flashcards PRIMARY KEY (id),
    CONSTRAINT fk_flashcards_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);

CREATE TABLE quizzes (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_quizzes PRIMARY KEY (id),
    CONSTRAINT fk_quizzes_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);

CREATE TABLE quiz_questions (
    id VARCHAR(36) NOT NULL,
    quiz_id VARCHAR(36) NOT NULL,
    type VARCHAR(20) NOT NULL,
    question TEXT NOT NULL,
    options_json TEXT,
    correct_answer TEXT NOT NULL,
    citation TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_quiz_questions PRIMARY KEY (id),
    CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
);

CREATE TABLE bookmarks (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_bookmarks PRIMARY KEY (id),
    CONSTRAINT fk_bookmarks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);

CREATE TABLE study_sessions (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_study_sessions PRIMARY KEY (id),
    CONSTRAINT fk_study_sessions_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);


-- >>> V9__add_knowledge_workspace_tables.sql <<<
CREATE TABLE folders (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id VARCHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_folders PRIMARY KEY (id),
    CONSTRAINT fk_folders_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_parent FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
);

ALTER TABLE documents ADD COLUMN folder_id VARCHAR(36) DEFAULT NULL;
ALTER TABLE documents ADD CONSTRAINT fk_documents_folder FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL;

CREATE TABLE tags (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_tags PRIMARY KEY (id),
    CONSTRAINT fk_tags_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);

CREATE TABLE document_tags (
    document_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    CONSTRAINT pk_document_tags PRIMARY KEY (document_id, tag_id),
    CONSTRAINT fk_dt_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    CONSTRAINT fk_dt_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE TABLE collections (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_collections PRIMARY KEY (id),
    CONSTRAINT fk_collections_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);

CREATE TABLE collection_items (
    id VARCHAR(36) NOT NULL,
    collection_id VARCHAR(36) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_collection_items PRIMARY KEY (id),
    CONSTRAINT fk_ci_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
);

CREATE TABLE favorites (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_favorites PRIMARY KEY (id),
    CONSTRAINT fk_favorites_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);

CREATE TABLE recent_activity (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    item_type VARCHAR(50),
    item_id VARCHAR(36),
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_recent_activity PRIMARY KEY (id),
    CONSTRAINT fk_ra_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);


-- >>> V10__add_ai_platform_tables.sql <<<
CREATE TABLE ai_prompts (
    id VARCHAR(36) NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_ai_prompts PRIMARY KEY (id)
);

CREATE TABLE ai_usage_logs (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36),
    user_id VARCHAR(36),
    feature_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    latency_ms BIGINT,
    is_error BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_ai_usage_logs PRIMARY KEY (id)
);

CREATE TABLE ai_cache (
    cache_key VARCHAR(255) NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    CONSTRAINT pk_ai_cache PRIMARY KEY (cache_key)
);

INSERT INTO ai_prompts (id, feature_name, version, template, is_active) VALUES
('p-chat-1', 'CHAT', 1, 'You are an academic tutor. Context: {{context}}. Question: {{question}}', TRUE),
('p-flash-1', 'FLASHCARD_GEN', 1, 'Generate exactly {{count}} flashcards. JSON array only. Context: {{context}}', TRUE),
('p-quiz-1', 'QUIZ_GEN', 1, 'Generate exactly {{count}} {{difficulty}} questions. JSON array only. Context: {{context}}', TRUE),
('p-sum-1', 'SUMMARY_GEN', 1, 'Summarize the text. {{instruction}} Context: {{context}}', TRUE);


-- >>> V11__add_chat_tables.sql <<<
CREATE TABLE chat_sessions (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_chat_sessions PRIMARY KEY (id),
    CONSTRAINT fk_cs_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE chat_messages (
    id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    citations_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_chat_messages PRIMARY KEY (id),
    CONSTRAINT fk_cm_session FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
);


-- >>> V12__add_workspace_status.sql <<<
ALTER TABLE workspaces ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';


-- >>> V13__widen_document_type.sql <<<
ALTER TABLE documents ALTER COLUMN type SET DATA TYPE VARCHAR(255);
ALTER TABLE documents ALTER COLUMN type SET NOT NULL;


-- >>> V14__add_pdf_assistant_tables.sql <<<
CREATE TABLE pdf_documents (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100),
    storage_key VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL,
    processing_source VARCHAR(20),
    summary TEXT,
    chunk_count INT,
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pdf_documents PRIMARY KEY (id),
    CONSTRAINT fk_pdf_doc_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_pdf_doc_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_pdf_documents_workspace_owner ON pdf_documents (workspace_id, owner_id);

CREATE TABLE pdf_chat_messages (
    id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pdf_chat_messages PRIMARY KEY (id),
    CONSTRAINT fk_pdf_chat_document FOREIGN KEY (document_id) REFERENCES pdf_documents (id) ON DELETE CASCADE,
    CONSTRAINT fk_pdf_chat_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);


-- >>> V15__create_academic_planner_tables.sql <<<
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
    ai_confidence DOUBLE PRECISION NULL,
    source_file VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_academic_events PRIMARY KEY (id),
    CONSTRAINT fk_academic_event_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_academic_events_owner_date ON academic_events (owner_id, event_date);
CREATE INDEX idx_academic_events_owner_category ON academic_events (owner_id, category);

CREATE TABLE planner_study_items (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    plan_date DATE NOT NULL,
    start_time TIME NULL,
    subject VARCHAR(255) NOT NULL,
    hours DOUBLE PRECISION NOT NULL DEFAULT 1,
    session_type VARCHAR(50) NOT NULL DEFAULT 'STUDY',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_planner_study_items PRIMARY KEY (id),
    CONSTRAINT fk_planner_study_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_planner_study_owner_date ON planner_study_items (owner_id, plan_date);


-- >>> V16__create_placement_tables.sql <<<
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


-- >>> V17__create_tasks_table.sql <<<
CREATE TABLE tasks (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    deadline TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_tasks PRIMARY KEY (id),
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_user ON tasks (user_id);
CREATE INDEX idx_tasks_user_status ON tasks (user_id, status);
CREATE INDEX idx_tasks_user_deadline ON tasks (user_id, deadline);


-- >>> V18__add_task_assistant_columns.sql <<<
ALTER TABLE tasks
    ADD COLUMN progress_notes TEXT NULL,
    ADD COLUMN parent_task_id VARCHAR(36) NULL,
    ADD CONSTRAINT fk_tasks_parent_task FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE CASCADE;


-- >>> V19__task_assistant_core.sql <<<
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


-- >>> V20__add_feedback_and_aptitude_admin.sql <<<
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

-- >>> Performance & Query Optimization Indexes <<<
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by ON jobs (posted_by_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications (job_id);
CREATE INDEX IF NOT EXISTS idx_applications_student_status ON applications (student_id, status);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_created ON workspaces (owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_deadline ON tasks (user_id, status, deadline);


