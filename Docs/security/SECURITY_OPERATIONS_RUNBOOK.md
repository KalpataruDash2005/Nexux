# Nexora — Security Operations Runbook (SecOps Runbook)

## 1. Overview & Operational Scope

This runbook provides actionable, step-by-step instructions for Site Reliability Engineers (SREs), DevSecOps practitioners, and application administrators responsible for maintaining the operational security posture of the Nexora SaaS platform.

---

## 2. Routine Security Checklists

### Daily Checklists
- [ ] Inspect structured security audit logs for anomalous `BOLA_ACCESS_DENIED` or `ROLE_ESCALATION_ATTEMPT` spikes.
- [ ] Review rate-limiting alerts (`RATE_LIMIT_EXCEEDED`) on AI chat, resume parsing, and code execution endpoints.
- [ ] Verify production health status via `GET https://nexoraos.space/api/v1/health`.

### Weekly Checklists
- [ ] Review Vercel deployment logs and edge security metrics for unusual traffic patterns or 4xx/5xx clusters.
- [ ] Audit dependency vulnerability advisories (`npm audit` and `pip-audit`).
- [ ] Validate automated backup snapshots in Supabase PostgreSQL.

### Monthly & Quarterly Checklists
- [ ] Rotate secondary API keys (`XAI_BACKUP_API_KEY`) and review token quotas.
- [ ] Run full regression suite (`pytest api/tests/test_*.py`) and frontend build checks.
- [ ] Execute quarterly user access reviews for accounts with `ADMIN` privileges.

---

## 3. Emergency Operational Runbooks

### Runbook 1: Emergency Token & Session Invalidation
**When to execute:** A user reports account compromise or an active JWT token is suspected intercepted.
1. Identify the user email or token `jti` from audit logs.
2. If user is accessible, execute `POST /api/v1/auth/logout` with Bearer token.
3. For immediate global revocation across all instances: Update `JWT_SECRET` in Vercel project environment variables and trigger an instant deployment. All existing JWT signatures become immediately invalid.

---

### Runbook 2: Secret & Key Rotation
**When to execute:** Suspected credential leak or routine rotation.
1. **JWT Secret:**
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
   Set `JWT_SECRET` in Vercel environment variables → Redeploy.
2. **xAI Grok API Key:**
   - In xAI Console: Generate a new key.
   - Set `XAI_BACKUP_API_KEY` in Vercel to test connectivity.
   - Once verified, promote to `XAI_API_KEY` and delete the old key in xAI console.
3. **Database Credentials (Supabase):**
   - Reset password in Supabase Dashboard → Settings → Database.
   - Update `DATABASE_URL` in Vercel environment variables → Redeploy.

---

### Runbook 3: Investigating BOLA Access Denial Alerts
**When to execute:** Log monitor flags `BOLA_ACCESS_DENIED`.
1. Query logs by `event_type == "BOLA_ACCESS_DENIED"`.
2. Note the `correlation_id`, `user_id`, `client_ip`, and `resource` details.
3. Trace the user session across `CorrelationIdMiddleware` logs using `correlation_id`.
4. Determine whether the request was an intentional exploit attempt (e.g. sequential ID incrementing) or a client UI bug.
5. If malicious, add offending client IP to Vercel Firewall / Cloudflare WAF blocklist.

---

### Runbook 4: Admin Account Provisioning
**When to execute:** Onboarding a new system administrator.
- Public registration (`POST /api/v1/auth/register`) rejects `ADMIN` role assignment.
- To create or promote an administrator, run the standalone CLI tool:
  ```bash
  python scripts/provision_admin.py --email "admin@nexora.app" --password "YourStrongPassword123!"
  ```
- Requirements: Password must be 12+ characters and contain uppercase, lowercase, numbers, and symbols.

---

## 4. DevSecOps Pull Request Quality Gates

Before merging any pull request to `main`:
1. **Automated Security Suite:**
   ```bash
   $env:PYTHONPATH="api"; py -3.12 -m pytest (Get-ChildItem api/tests/test_*.py).FullName
   ```
   Must pass 100% (161/161 tests).
2. **Frontend Typecheck & Production Build:**
   ```bash
   cd frontend && npm run build
   ```
   Must compile cleanly with zero TypeScript errors.
3. **Secrets Verification:**
   Ensure no `.env` or credential files are staged:
   ```bash
   git status
   ```
