-- ==============================================================
-- NEXAURA / CareerOS — Consolidated MySQL 8.0 Schema (V1-V20)
-- Optimized for MySQL 8.0+ with utf8mb4 encoding & InnoDB engine
-- ==============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users table (Central authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Student Profiles table (1-to-1 with users)
CREATE TABLE IF NOT EXISTS student_profiles (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    university VARCHAR(255) NULL,
    degree VARCHAR(100) NULL,
    graduation_year INT NULL,
    skills TEXT NULL,
    resume_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_student_profiles_user (user_id),
    CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Jobs table (Campus recruitment & postings)
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(36) NOT NULL,
    posted_by_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    description LONGTEXT NOT NULL,
    location VARCHAR(255) NULL,
    salary VARCHAR(100) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_jobs_posted_by (posted_by_id),
    KEY idx_jobs_status_created (status, created_at),
    CONSTRAINT fk_jobs_user FOREIGN KEY (posted_by_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Applications table
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(36) NOT NULL,
    job_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_application_job_student (job_id, student_id),
    KEY idx_applications_job (job_id),
    KEY idx_applications_student_status (student_id, status),
    CONSTRAINT fk_applications_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
    CONSTRAINT fk_applications_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    owner_id VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_workspaces_owner_created (owner_id, created_at),
    CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Folders table (Hierarchical file organization)
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_folders_workspace (workspace_id),
    CONSTRAINT fk_folders_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_parent FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Documents table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    folder_id VARCHAR(36) NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    size BIGINT NULL,
    storage_url VARCHAR(500) NULL,
    metadata_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_documents_workspace (workspace_id),
    KEY idx_documents_folder (folder_id),
    CONSTRAINT fk_documents_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_documents_folder FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Summaries table
CREATE TABLE IF NOT EXISTS summaries (
    id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_summaries_document (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_flashcards_workspace (workspace_id),
    CONSTRAINT fk_flashcards_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_quizzes_workspace (workspace_id),
    CONSTRAINT fk_quizzes_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Quiz Questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR(36) NOT NULL,
    quiz_id VARCHAR(36) NOT NULL,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_answer VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_quiz_questions_quiz (quiz_id),
    CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    page_number INT NULL,
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_bookmarks_workspace (workspace_id),
    CONSTRAINT fk_bookmarks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Study Sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    duration_minutes INT NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_study_sessions_workspace (workspace_id),
    CONSTRAINT fk_study_sessions_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Tags table
CREATE TABLE IF NOT EXISTS tags (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tags_workspace (workspace_id),
    CONSTRAINT fk_tags_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Document Tags join table
CREATE TABLE IF NOT EXISTS document_tags (
    document_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (document_id, tag_id),
    CONSTRAINT fk_dt_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    CONSTRAINT fk_dt_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Collections table
CREATE TABLE IF NOT EXISTS collections (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_collections_workspace (workspace_id),
    CONSTRAINT fk_collections_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Collection Items join table
CREATE TABLE IF NOT EXISTS collection_items (
    collection_id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (collection_id, document_id),
    CONSTRAINT fk_ci_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_favorites_workspace (workspace_id),
    CONSTRAINT fk_favorites_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Recent Activity table
CREATE TABLE IF NOT EXISTS recent_activity (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    details TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ra_workspace (workspace_id),
    CONSTRAINT fk_ra_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. AI Prompts table
CREATE TABLE IF NOT EXISTS ai_prompts (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    system_prompt LONGTEXT NOT NULL,
    user_prompt_template LONGTEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. AI Usage Logs table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    is_error TINYINT(1) NOT NULL DEFAULT 0,
    latency_ms BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ai_usage_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. AI Cache table
CREATE TABLE IF NOT EXISTS ai_cache (
    cache_key VARCHAR(64) NOT NULL,
    response_text LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (cache_key),
    KEY idx_ai_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. Chat Sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_chat_sessions_workspace (workspace_id),
    KEY idx_chat_sessions_owner (owner_id),
    CONSTRAINT fk_cs_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_chat_messages_session (session_id),
    CONSTRAINT fk_cm_session FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. PDF Documents table (RAG pipeline)
CREATE TABLE IF NOT EXISTS pdf_documents (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100) NULL DEFAULT 'application/pdf',
    storage_key VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    processing_source VARCHAR(20) NULL DEFAULT 'NATIVE',
    summary LONGTEXT NULL,
    chunk_count INT NULL DEFAULT 0,
    error_message LONGTEXT NULL,
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pdf_documents_workspace_owner (workspace_id, owner_id),
    KEY idx_pdf_documents_workspace (workspace_id),
    KEY idx_pdf_documents_owner (owner_id),
    CONSTRAINT fk_pdf_doc_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_pdf_doc_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. PDF Chat Messages table
CREATE TABLE IF NOT EXISTS pdf_chat_messages (
    id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pdf_chat_document (document_id),
    KEY idx_pdf_chat_owner (owner_id),
    CONSTRAINT fk_pdf_chat_document FOREIGN KEY (document_id) REFERENCES pdf_documents (id) ON DELETE CASCADE,
    CONSTRAINT fk_pdf_chat_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. Academic Events table
CREATE TABLE IF NOT EXISTS academic_events (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    event_date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    color VARCHAR(20) NULL,
    location VARCHAR(255) NULL,
    semester VARCHAR(100) NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    needs_verification TINYINT(1) NOT NULL DEFAULT 0,
    ai_confidence DOUBLE NULL,
    source_file VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_academic_events_owner_date (owner_id, event_date),
    KEY idx_academic_events_owner_category (owner_id, category),
    CONSTRAINT fk_academic_event_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. Planner Study Items table
CREATE TABLE IF NOT EXISTS planner_study_items (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    plan_date DATE NOT NULL,
    start_time TIME NULL,
    subject VARCHAR(255) NOT NULL,
    hours DOUBLE NOT NULL DEFAULT 1,
    session_type VARCHAR(50) NOT NULL DEFAULT 'STUDY',
    completed TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_planner_study_owner_date (owner_id, plan_date),
    CONSTRAINT fk_planner_study_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 29. Placement Resumes table
CREATE TABLE IF NOT EXISTS placement_resumes (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    text LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_placement_resume_owner (owner_id),
    CONSTRAINT fk_placement_resume_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 30. Placement Resume Analyses table
CREATE TABLE IF NOT EXISTS placement_resume_analyses (
    id VARCHAR(36) NOT NULL,
    resume_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    analysis_json LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_placement_analysis_resume (resume_id),
    KEY idx_placement_analysis_owner (owner_id),
    CONSTRAINT fk_placement_analysis_resume FOREIGN KEY (resume_id) REFERENCES placement_resumes (id) ON DELETE CASCADE,
    CONSTRAINT fk_placement_analysis_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 31. Placement Sessions table
CREATE TABLE IF NOT EXISTS placement_sessions (
    id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    type VARCHAR(30) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'AI',
    role VARCHAR(100) NULL,
    company VARCHAR(100) NULL,
    difficulty VARCHAR(20) NULL,
    topic VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    score INT NULL,
    payload_json LONGTEXT NULL,
    summary LONGTEXT NULL,
    started_at DATETIME NULL,
    ended_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_placement_session_owner_created (owner_id, created_at),
    CONSTRAINT fk_placement_session_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 32. Placement Messages table
CREATE TABLE IF NOT EXISTS placement_messages (
    id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content LONGTEXT NOT NULL,
    analysis_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_placement_message_session (session_id),
    KEY idx_placement_message_owner (owner_id),
    CONSTRAINT fk_placement_message_session FOREIGN KEY (session_id) REFERENCES placement_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_placement_message_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 33. Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    deadline DATETIME NULL,
    progress_notes LONGTEXT NULL,
    parent_task_id VARCHAR(36) NULL,
    estimated_hours DECIMAL(5,2) NULL,
    remaining_hours DECIMAL(5,2) NULL,
    chunk_index INT NULL,
    total_chunks INT NULL,
    ai_generated TINYINT(1) NOT NULL DEFAULT 0,
    started_at DATETIME NULL,
    paused_at DATETIME NULL,
    completed_at DATETIME NULL,
    last_activity DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_user (user_id),
    KEY idx_tasks_user_status (user_id, status),
    KEY idx_tasks_user_deadline (user_id, deadline),
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_parent_task FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 34. AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    content LONGTEXT NOT NULL,
    task_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ai_conversations_user_created (user_id, created_at),
    CONSTRAINT fk_ai_conversations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 35. AI Memory table
CREATE TABLE IF NOT EXISTS ai_memory (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    mem_key VARCHAR(64) NOT NULL,
    mem_value VARCHAR(500) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ai_memory_user_key (user_id, mem_key),
    CONSTRAINT fk_ai_memory_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 36. Feedback Submissions table
CREATE TABLE IF NOT EXISTS feedback_submissions (
    id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NULL,
    email VARCHAR(255) NOT NULL,
    message LONGTEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_feedback_submissions_status (status),
    KEY idx_feedback_submissions_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 37. Aptitude Sets table
CREATE TABLE IF NOT EXISTS aptitude_sets (
    id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NULL,
    question_count INT NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_aptitude_sets_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 38. Aptitude Questions table
CREATE TABLE IF NOT EXISTS aptitude_questions (
    id VARCHAR(36) NOT NULL,
    set_id VARCHAR(36) NOT NULL,
    text LONGTEXT NOT NULL,
    options_json LONGTEXT NOT NULL,
    correct_index INT NOT NULL,
    explanation LONGTEXT NULL,
    difficulty VARCHAR(20) NULL,
    topic VARCHAR(100) NULL,
    category VARCHAR(50) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_aptitude_question_set (set_id),
    CONSTRAINT fk_aptitude_question_set FOREIGN KEY (set_id) REFERENCES aptitude_sets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
