# Nexora — Secrets Management Policy & Infrastructure Hardening

## 1. Executive Summary & Zero-Hardcoded-Secrets Mandate

The compromise of cryptographic secrets or infrastructure credentials represents an existential risk to Nexora and its customer tenants. Under no circumstances may plaintext API tokens, database credentials, cryptographic keys, or production service account credentials be committed to source control or exposed in client bundles.

This policy defines mandatory requirements for secrets storage, startup validation, continuous scanning, and emergency rotation across the Nexora SaaS application lifecycle.

---

## 2. Secrets Classification Taxonomy

| Tier | Category | Assets | Storage Mechanism | Access Scope |
| :---: | :--- | :--- | :--- | :--- |
| **Tier 1 (Critical)** | Primary Auth & Infrastructure | `JWT_SECRET`, `DATABASE_URL` (Supabase credentials), `SUPABASE_SECRET_KEY` | Vercel Serverless Encrypted Env | Backend runtime only |
| **Tier 2 (Sensitive)** | External AI & Vector Services | `XAI_API_KEY`, `XAI_BACKUP_API_KEY`, `QDRANT_API_KEY` | Vercel Serverless Encrypted Env | AI Gateway & Vectorstore only |
| **Tier 3 (Configuration)**| Environment & CORS Gates | `ENVIRONMENT`, `CORS_ALLOWED_ORIGINS`, `APP_NAME` | Environment Variables / Config | Application runtime |
| **Tier 4 (Public Client)**| Frontend Identifiers | `VITE_API_URL`, `VITE_APP_NAME` | Frontend Build Env | Client browser |

---

## 3. Defense-in-Depth Guardrails

### 3.1 Git Repository Invariants
- `.gitignore` enforces strict exclusion for all environment and cryptographic files:
  - `.env`, `.env.*`, `**/.env`, `**/.env.*` (excluding `.env.example` templates)
  - `*.pem`, `*.key`, `*.secret`, `*.p12`, `*.keystore`, `id_rsa`
- Verified repository history contains zero plaintext production secrets.

### 3.2 Startup Fail-Fast Validation (`validate_security()`)
During application lifespan initialization, `settings.validate_security()` halts the FastAPI application container immediately if any of the following production safety invariants fail:
1. `JWT_SECRET` is omitted, matches development placeholder strings, or is shorter than 32 characters (256 bits).
2. `ENABLE_HOST_CODE_EXECUTION` is set to `True` in production.
3. `DEBUG` mode is set to `True` in production.
4. `CORS_ALLOWED_ORIGINS` contains wildcard (`*`) in production.

---

## 4. Emergency Secret Rotation Procedures

In the event of suspected credential compromise or scheduled quarterly rotation:

### 4.1 JWT Secret Key Rotation
1. Generate a new 256-bit cryptographically secure secret:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Update `JWT_SECRET` in Vercel Project Environment Variables (Production & Preview).
3. Trigger a production redeployment. Existing tokens will be invalidated, prompting users to re-authenticate with zero database or customer data loss.

### 4.2 Database Password Rotation (Supabase)
1. In Supabase Dashboard: Navigate to Project Settings → Database → Reset Database Password.
2. Update `DATABASE_URL` in Vercel Project Environment Variables with the new connection string.
3. Verify connection pool recycle and pre-ping via `/api/v1/health`.

### 4.3 xAI Grok API Key Rotation
1. Generate new API keys in xAI Management Console.
2. Populate `XAI_BACKUP_API_KEY` with the new key in Vercel.
3. Promote `XAI_BACKUP_API_KEY` to `XAI_API_KEY` once verified.
4. Revoke the superseded key in the xAI Console.
