# NEXORA — DEPLOYMENT AND ROLLBACK GUIDE
**Standard Operating Procedures for Preview Deployment, Production Promotion & Emergency Rollback**

- **Target Application:** Nexora (`https://nexoraos.space`)
- **Hosting Provider:** Vercel Serverless
- **Hardening Branch:** `security/enterprise-hardening` (Commit: `3a60ad1`)
- **Production Branch:** `main`

---

## 1. Step-by-Step Preview Deployment Procedure

Deploying a Vercel Preview environment allows testing the complete hardened application in a realistic cloud environment without impacting production users or production data:

1. **Verify Local Git State:**
   ```bash
   git checkout security/enterprise-hardening
   git status
   # Ensure working tree is clean on commit 3a60ad1
   ```
2. **Push Hardening Branch to GitHub:**
   ```bash
   git push origin security/enterprise-hardening
   ```
3. **Verify Vercel Preview Build:**
   - Vercel automatically creates a preview deployment URL for branches pushed to GitHub (e.g. `https://nexux-git-security-enterprise-hardening-*.vercel.app`).
   - Inspect build logs in the Vercel dashboard to verify frontend static build and backend serverless function packaging succeed.
4. **Preview Smoke Test Checklist:**
   - [ ] Navigate to the preview URL.
   - [ ] Register a new student account (`test_preview@nexora.app`).
   - [ ] Log in and verify JWT access token is stored.
   - [ ] Update profile with phone number; verify profile displays updated phone.
   - [ ] Upload a test PDF document in Workspace; verify magic byte validation and text extraction.
   - [ ] Run a test coding assessment submission; verify hidden test cases remain masked.
   - [ ] Change account password; verify previous access token is rejected on next request.
   - [ ] Log out; verify token is rejected.

---

## 2. Production Promotion Procedure

Once the Preview Smoke Test passes and the database migrations (`001`, `002`) have been applied to Supabase, promote the changes to production:

1. **Apply Supabase Migrations (Maintenance Window):**
   - Execute `scripts/migrations/001_enable_supabase_rls.sql`.
   - Execute `scripts/migrations/002_add_session_revocation_and_token_version.sql`.
2. **Verify Vercel Production Environment Variables:**
   - Confirm `JWT_SECRET`, `ENVIRONMENT=production`, and `CORS_ALLOWED_ORIGINS` are set.
3. **Merge Hardening Branch to Main:**
   ```bash
   git checkout main
   git pull origin main
   git merge security/enterprise-hardening --ff-only
   git push origin main
   ```
   *(Note: If fast-forward is not possible due to landing page adjustments, perform a standard merge commit preserving security changes).*
4. **Monitor Vercel Production Deployment:**
   - Open Vercel Dashboard for `nexoraos.space`.
   - Monitor the deployment progress.
   - Perform live verification on `https://nexoraos.space/api/v1/health`.

---

## 3. Emergency Rollback Runbook

If any critical issue or unexpected failure occurs after production promotion:

### Level 1: Instant Vercel Deployment Rollback (< 60 seconds)
1. Open the **Vercel Dashboard $\rightarrow$ Deployments**.
2. Locate the previous stable production deployment (prior to the promotion).
3. Click the three dots `...` on the deployment and select **Instant Rollback (Promote to Production)**.
4. Vercel immediately redirects 100% of traffic to the previous build artifact with zero downtime.

### Level 2: Git Rollback Procedure
If git state needs to be reverted on `main`:
```bash
git checkout main
git revert -m 1 HEAD --no-edit
git push origin main
```

### Level 3: Database Migration Rollback (If Required)
The schema additions (`token_version`, `phone`, `revoked_tokens`) are additive and backward-compatible. Existing features will continue functioning even if the application code is rolled back.

If RLS policies cause permission conflicts on legacy third-party tools, RLS can be temporarily disabled per table:
```sql
-- Emergency RLS bypass script (use only if critical production data access is blocked)
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles DISABLE ROW LEVEL SECURITY;
```
*(Re-enable as soon as permissions are reconciled).*
