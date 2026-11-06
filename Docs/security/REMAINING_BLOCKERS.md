# NEXORA — REMAINING PRODUCTION BLOCKERS
**Inventory of External, Infrastructure, and Operational Action Items**

All application source code issues, security bugs, and unit test requirements have been resolved in the repository. 

The following items are external administrative, operational, or infrastructure requirements that cannot be executed from repository code alone and must be completed by authorized project administrators prior to production promotion:

---

## 1. Blocker Item B-01: Supabase Database Migration Execution

- **Severity:** High
- **Description:** The new database security controls (Row-Level Security across 23 tables, `token_version` column on `users`, `phone` column on `student_profiles`, and the `revoked_tokens` table) require DDL execution on the live Supabase PostgreSQL database.
- **Why It Cannot Be Run Automatically:** Per the engagement safety rules, agents must never execute destructive or unapproved migrations directly against production databases.
- **Required Action:**
  1. Open the [Supabase Dashboard](https://app.supabase.com) for the project.
  2. Navigate to **SQL Editor**.
  3. Execute `scripts/migrations/001_enable_supabase_rls.sql`.
  4. Execute `scripts/migrations/002_add_session_revocation_and_token_version.sql`.
  5. Verify that RLS is enabled on all tables:
     ```sql
     SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
     ```

---

## 2. Blocker Item B-02: Production Environment Variable Configuration

- **Severity:** High
- **Description:** The application enforces strict production safety checks (`Settings.validate_security()`). If `ENVIRONMENT=production` is set but credentials are weak or missing, the API intentionally halts to prevent insecure operation.
- **Required Action in Vercel Project Settings:**
  Navigate to **Vercel Dashboard $\rightarrow$ Project Settings $\rightarrow$ Environment Variables** and configure the following variables for the `Production` environment:
  - `ENVIRONMENT`: Set to `production`.
  - `DEBUG`: Set to `False`.
  - `JWT_SECRET`: Generate a 64-character cryptographically secure string (e.g., using `openssl rand -hex 32`). Must not use the development default string.
  - `CORS_ALLOWED_ORIGINS`: Set to `https://nexoraos.space,https://www.nexoraos.space`. (Wildcard `*` will trigger an immediate startup exception).
  - `UPSTASH_REDIS_REST_URL`: (Recommended) REST URL for distributed rate limiting across serverless instances.
  - `UPSTASH_REDIS_REST_TOKEN`: (Recommended) Upstash REST API bearer token.

---

## 3. Blocker Item B-03: External Code Execution Compute (Judge0) Provisioning (Optional)

- **Severity:** Low / Optional
- **Description:** The coding assessment platform operates safely in production by falling back to hermetic AI evaluation, completely blocking arbitrary host subprocess execution. If the product requires real containerized compilation and execution (e.g. g++ / node.js execution for students), external isolated compute must be provisioned.
- **Required Action (Only if real container execution is desired in production):**
  1. Provision a Judge0 CE / RapidAPI instance or self-hosted gVisor container cluster.
  2. Add `JUDGE0_URL` and `JUDGE0_API_KEY` to Vercel environment variables.
  3. If not provisioned, the application continues to run hermetic AI evaluation safely with zero security risk.

---

## 4. Blocker Checklist for Deployment Manager

- [ ] Execute `001_enable_supabase_rls.sql` in Supabase SQL editor.
- [ ] Execute `002_add_session_revocation_and_token_version.sql` in Supabase SQL editor.
- [ ] Configure production `JWT_SECRET` in Vercel.
- [ ] Set `ENVIRONMENT=production` and `DEBUG=False` in Vercel.
- [ ] Verify `CORS_ALLOWED_ORIGINS` has no wildcard in Vercel.
- [ ] (Optional) Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Deploy to Vercel Preview and run smoke test.
- [ ] Promote to Production (`nexoraos.space`).
