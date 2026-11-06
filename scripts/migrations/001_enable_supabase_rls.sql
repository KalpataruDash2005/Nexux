-- =============================================================================
-- NEXORA SaaS Platform — Supabase PostgreSQL Row-Level Security (RLS) Migration
-- Script: scripts/migrations/001_enable_supabase_rls.sql
-- Description: Idempotent migration to enforce strict multi-tenant isolation,
--              service-role bypass, and least-privilege access across all tables.
-- =============================================================================

BEGIN;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
              AND role = 'ADMIN'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 1. USERS TABLE
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_users" ON users;
CREATE POLICY "service_role_bypass_users" ON users
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users_select_own_or_admin" ON users;
CREATE POLICY "users_select_own_or_admin" ON users
    FOR SELECT TO authenticated
    USING (id = auth.uid()::text OR is_admin());

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
    FOR UPDATE TO authenticated
    USING (id = auth.uid()::text)
    WITH CHECK (id = auth.uid()::text);

-- =============================================================================
-- 2. STUDENT PROFILES
-- =============================================================================
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_profiles" ON student_profiles;
CREATE POLICY "service_role_bypass_profiles" ON student_profiles
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON student_profiles;
CREATE POLICY "profiles_select_own_or_admin" ON student_profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text OR is_admin());

DROP POLICY IF EXISTS "profiles_modify_own" ON student_profiles;
CREATE POLICY "profiles_modify_own" ON student_profiles
    FOR ALL TO authenticated
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- =============================================================================
-- 3. WORKSPACES
-- =============================================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_workspaces" ON workspaces;
CREATE POLICY "service_role_bypass_workspaces" ON workspaces
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "workspaces_owner_access" ON workspaces;
CREATE POLICY "workspaces_owner_access" ON workspaces
    FOR ALL TO authenticated
    USING (owner_id = auth.uid()::text OR is_admin())
    WITH CHECK (owner_id = auth.uid()::text);

-- =============================================================================
-- 4. PDF DOCUMENTS & CHAT MESSAGES
-- =============================================================================
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_pdf_documents" ON pdf_documents;
CREATE POLICY "service_role_bypass_pdf_documents" ON pdf_documents
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pdf_documents_owner_access" ON pdf_documents;
CREATE POLICY "pdf_documents_owner_access" ON pdf_documents
    FOR ALL TO authenticated
    USING (owner_id = auth.uid()::text OR is_admin())
    WITH CHECK (owner_id = auth.uid()::text);

ALTER TABLE pdf_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_pdf_chat" ON pdf_chat_messages;
CREATE POLICY "service_role_bypass_pdf_chat" ON pdf_chat_messages
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pdf_chat_owner_access" ON pdf_chat_messages;
CREATE POLICY "pdf_chat_owner_access" ON pdf_chat_messages
    FOR ALL TO authenticated
    USING (owner_id = auth.uid()::text OR is_admin())
    WITH CHECK (owner_id = auth.uid()::text);

-- =============================================================================
-- 5. TASKS & AI CONVERSATIONS
-- =============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_tasks" ON tasks;
CREATE POLICY "service_role_bypass_tasks" ON tasks
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_user_access" ON tasks;
CREATE POLICY "tasks_user_access" ON tasks
    FOR ALL TO authenticated
    USING (user_id = auth.uid()::text OR is_admin())
    WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_ai_conversations" ON ai_conversations;
CREATE POLICY "service_role_bypass_ai_conversations" ON ai_conversations
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ai_conversations_user_access" ON ai_conversations;
CREATE POLICY "ai_conversations_user_access" ON ai_conversations
    FOR ALL TO authenticated
    USING (user_id = auth.uid()::text OR is_admin())
    WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_ai_memory" ON ai_memory;
CREATE POLICY "service_role_bypass_ai_memory" ON ai_memory
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ai_memory_user_access" ON ai_memory;
CREATE POLICY "ai_memory_user_access" ON ai_memory
    FOR ALL TO authenticated
    USING (user_id = auth.uid()::text OR is_admin())
    WITH CHECK (user_id = auth.uid()::text);

-- =============================================================================
-- 6. PLACEMENT RESUMES & SESSIONS
-- =============================================================================
ALTER TABLE placement_resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_placement_resumes" ON placement_resumes;
CREATE POLICY "service_role_bypass_placement_resumes" ON placement_resumes
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "placement_resumes_owner_access" ON placement_resumes;
CREATE POLICY "placement_resumes_owner_access" ON placement_resumes
    FOR ALL TO authenticated
    USING (owner_id = auth.uid()::text OR is_admin())
    WITH CHECK (owner_id = auth.uid()::text);

ALTER TABLE placement_resume_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_resume_analyses" ON placement_resume_analyses;
CREATE POLICY "service_role_bypass_resume_analyses" ON placement_resume_analyses
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "resume_analyses_owner_access" ON placement_resume_analyses;
CREATE POLICY "resume_analyses_owner_access" ON placement_resume_analyses
    FOR ALL TO authenticated
    USING (owner_id = auth.uid()::text OR is_admin())
    WITH CHECK (owner_id = auth.uid()::text);

ALTER TABLE placement_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_placement_sessions" ON placement_sessions;
CREATE POLICY "service_role_bypass_placement_sessions" ON placement_sessions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "placement_sessions_owner_access" ON placement_sessions;
CREATE POLICY "placement_sessions_owner_access" ON placement_sessions
    FOR ALL TO authenticated
    USING (owner_id = auth.uid()::text OR is_admin())
    WITH CHECK (owner_id = auth.uid()::text);

ALTER TABLE placement_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_placement_messages" ON placement_messages;
CREATE POLICY "service_role_bypass_placement_messages" ON placement_messages
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "placement_messages_owner_access" ON placement_messages;
CREATE POLICY "placement_messages_owner_access" ON placement_messages
    FOR ALL TO authenticated
    USING (owner_id = auth.uid()::text OR is_admin())
    WITH CHECK (owner_id = auth.uid()::text);

-- =============================================================================
-- 7. JOBS & APPLICATIONS (BOLA PREVENTATIVE POLICIES)
-- =============================================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_jobs" ON jobs;
CREATE POLICY "service_role_bypass_jobs" ON jobs
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "jobs_public_active_select" ON jobs;
CREATE POLICY "jobs_public_active_select" ON jobs
    FOR SELECT TO authenticated
    USING (status = 'ACTIVE' OR posted_by_id = auth.uid()::text OR is_admin());

DROP POLICY IF EXISTS "jobs_recruiter_manage_own" ON jobs;
CREATE POLICY "jobs_recruiter_manage_own" ON jobs
    FOR ALL TO authenticated
    USING (posted_by_id = auth.uid()::text OR is_admin())
    WITH CHECK (posted_by_id = auth.uid()::text);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_applications" ON applications;
CREATE POLICY "service_role_bypass_applications" ON applications
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "applications_student_view_own" ON applications;
CREATE POLICY "applications_student_view_own" ON applications
    FOR SELECT TO authenticated
    USING (student_id = auth.uid()::text OR is_admin());

DROP POLICY IF EXISTS "applications_student_insert_own" ON applications;
CREATE POLICY "applications_student_insert_own" ON applications
    FOR INSERT TO authenticated
    WITH CHECK (student_id = auth.uid()::text);

DROP POLICY IF EXISTS "applications_recruiter_job_owner_access" ON applications;
CREATE POLICY "applications_recruiter_job_owner_access" ON applications
    FOR ALL TO authenticated
    USING (
        job_id IN (
            SELECT id FROM jobs WHERE posted_by_id = auth.uid()::text
        ) OR is_admin()
    )
    WITH CHECK (
        job_id IN (
            SELECT id FROM jobs WHERE posted_by_id = auth.uid()::text
        ) OR is_admin()
    );

-- =============================================================================
-- 8. FEEDBACK & APTITUDE SETS
-- =============================================================================
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_feedback" ON feedback_submissions;
CREATE POLICY "service_role_bypass_feedback" ON feedback_submissions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_insert_any" ON feedback_submissions;
CREATE POLICY "feedback_insert_any" ON feedback_submissions
    FOR INSERT TO authenticated, anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_admin_oversight" ON feedback_submissions;
CREATE POLICY "feedback_admin_oversight" ON feedback_submissions
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

ALTER TABLE aptitude_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_aptitude_sets" ON aptitude_sets;
CREATE POLICY "service_role_bypass_aptitude_sets" ON aptitude_sets
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "aptitude_sets_select_all" ON aptitude_sets;
CREATE POLICY "aptitude_sets_select_all" ON aptitude_sets
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "aptitude_sets_admin_manage" ON aptitude_sets;
CREATE POLICY "aptitude_sets_admin_manage" ON aptitude_sets
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

ALTER TABLE aptitude_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_aptitude_questions" ON aptitude_questions;
CREATE POLICY "service_role_bypass_aptitude_questions" ON aptitude_questions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "aptitude_questions_select_all" ON aptitude_questions;
CREATE POLICY "aptitude_questions_select_all" ON aptitude_questions
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "aptitude_questions_admin_manage" ON aptitude_questions;
CREATE POLICY "aptitude_questions_admin_manage" ON aptitude_questions
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- =============================================================================
-- 9. DOCUMENTS, FLASHCARDS, QUIZZES
-- =============================================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_documents" ON documents;
CREATE POLICY "service_role_bypass_documents" ON documents
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "documents_workspace_owner_access" ON documents;
CREATE POLICY "documents_workspace_owner_access" ON documents
    FOR ALL TO authenticated
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
        ) OR is_admin()
    )
    WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
        ) OR is_admin()
    );

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_flashcards" ON flashcards;
CREATE POLICY "service_role_bypass_flashcards" ON flashcards
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "flashcards_workspace_owner_access" ON flashcards;
CREATE POLICY "flashcards_workspace_owner_access" ON flashcards
    FOR ALL TO authenticated
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
        ) OR is_admin()
    )
    WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
        ) OR is_admin()
    );

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_quizzes" ON quizzes;
CREATE POLICY "service_role_bypass_quizzes" ON quizzes
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "quizzes_workspace_owner_access" ON quizzes;
CREATE POLICY "quizzes_workspace_owner_access" ON quizzes
    FOR ALL TO authenticated
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
        ) OR is_admin()
    )
    WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()::text
        ) OR is_admin()
    );

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_quiz_questions" ON quiz_questions;
CREATE POLICY "service_role_bypass_quiz_questions" ON quiz_questions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "quiz_questions_access" ON quiz_questions;
CREATE POLICY "quiz_questions_access" ON quiz_questions
    FOR ALL TO authenticated
    USING (
        quiz_id IN (
            SELECT q.id FROM quizzes q
            JOIN workspaces w ON q.workspace_id = w.id
            WHERE w.owner_id = auth.uid()::text
        ) OR is_admin()
    )
    WITH CHECK (
        quiz_id IN (
            SELECT q.id FROM quizzes q
            JOIN workspaces w ON q.workspace_id = w.id
            WHERE w.owner_id = auth.uid()::text
        ) OR is_admin()
    );


-- =============================================================================
-- 22. SUMMARIES TABLE
-- =============================================================================
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_summaries" ON summaries;
CREATE POLICY "service_role_bypass_summaries" ON summaries
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "summaries_access" ON summaries;
CREATE POLICY "summaries_access" ON summaries
    FOR ALL TO authenticated
    USING (
        document_id IN (
            SELECT id FROM pdf_documents WHERE owner_id = auth.uid()::text
        ) OR document_id IN (
            SELECT d.id FROM documents d JOIN workspaces w ON d.workspace_id = w.id WHERE w.owner_id = auth.uid()::text
        ) OR is_admin()
    )
    WITH CHECK (
        document_id IN (
            SELECT id FROM pdf_documents WHERE owner_id = auth.uid()::text
        ) OR document_id IN (
            SELECT d.id FROM documents d JOIN workspaces w ON d.workspace_id = w.id WHERE w.owner_id = auth.uid()::text
        ) OR is_admin()
    );

-- =============================================================================
-- 23. REVOKED TOKENS (Backend Session Revocation Storage)
-- =============================================================================
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_revoked_tokens" ON revoked_tokens;
CREATE POLICY "service_role_bypass_revoked_tokens" ON revoked_tokens
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Authenticated and anonymous clients have no direct access to revoked tokens table

COMMIT;
