-- =============================================================================
-- NEXORA SaaS Platform — Database Migration 002
-- Script: scripts/migrations/002_add_session_revocation_and_token_version.sql
-- Description: Adds user token_version column for cross-serverless session invalidation,
--              encrypted phone column to student_profiles, and revoked_tokens table.
-- =============================================================================

BEGIN;

-- 1. Add token_version to users table for global session invalidation
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

-- 2. Add phone column to student_profiles for AES-256-GCM encrypted contact data
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(255) NULL;

-- 3. Create persistent revoked_tokens table for serverless single-token revocation
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id VARCHAR(36) PRIMARY KEY,
    jti VARCHAR(64) UNIQUE NOT NULL,
    token_hash VARCHAR(64) NULL,
    revoked_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITHOUT TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- 4. Enable RLS on revoked_tokens with service_role bypass
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_revoked_tokens" ON revoked_tokens;
CREATE POLICY "service_role_bypass_revoked_tokens" ON revoked_tokens
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

COMMIT;
