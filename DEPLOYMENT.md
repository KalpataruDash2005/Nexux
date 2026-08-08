# CareerOS — Production Deployment Guide

Stack after the production migration:

| Layer | Provider | Tech |
|-------|----------|------|
| Frontend | Vercel | React 18 + Vite + TypeScript |
| Backend | Railway | Spring Boot 3.3 (Java 21) |
| Database | Supabase (or any PostgreSQL 14+) | PostgreSQL, migrated by Flyway on startup |
| AI / embeddings | user-supplied | LangChain4j + OpenRouter/Groq/OpenAI + Qdrant |
| PDF Assistant | optional | n8n workflow + Qdrant |

All code changes for production were deployment-preparatory only: **no business logic, UI, or
features were changed.**

---

## 1. Database — Supabase (or any Postgres)

1. Create a PostgreSQL database (16.x recommended). Supabase instant project.
2. Run the schema using the migration files (do NOT use the legacy MySQL set):
   `backend/src/main/resources/db/migration-pg/V1__…V20__…`
   - Recommended: let Flyway do it automatically on first backend boot, or apply manually:
     `psql "$DATABASE_URL" -f backend/src/main/resources/db/migration-pg/V1__create_users_table.sql` … (V1→V20 in order).
3. Note the connection string: `postgresql://user:pass@host:5432/dbname`. On Supabase pick
   "Connection string → URI → Transaction pooler (port 6543)" if you want a pooler, or
   direct (port 5432) locally. Keep `ssl-mode=require` in production.

> The old MySQL Flyway directory `backend/src/main/resources/db/migration/` is legacy and is
> **not** read anymore — only `db/migration-pg` is enabled.

---

## 2. Backend — Railway (Docker)

Railway picks the `Dockerfile` in `backend/`. The app reads `PORT` (Railway injects it) and falls
back to `8081`.

Backend service env vars:

```
SPRING_PROFILES_ACTIVE=prod
PORT=8080            # Railway injects this automatically; not required to set
DB_HOST=…            # e.g. aws-0-us-west-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=careeros_db
DB_USER=careeros_user
DB_PASSWORD=…
JWT_SECRET=<64+ random chars>            # REQUIRED in prod (no default)
FRONTEND_URL=https://<your-frontend-domain>
CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
OAUTH_COOKIE_SECRET=<random 32+ bytes>
# AI (optional but recommended)
OPENAI_API_KEY=…              # OpenRouter/Groq/OpenAI compatible key
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=…
QDRANT_HOST=…
QDRANT_PORT=6334
QDRANT_REST_PORT=6333
# n8n / PDF assistant (optional)
PDF_ASSISTANT_N8N_ENABLED=false   # disable unless you host n8n reachable from backend
N8N_WEBHOOK_URL=…
N8N_API_KEY=…
N8N_EMBEDDING_API_KEY=…
CAREEROS_ADMIN_EMAIL=admin@…
CAREEROS_ADMIN_PASSWORD=<long random>
MAIL_HOST=smtp.gmail.com        # optional SMTP for feedback/notifications
MAIL_PORT=587
MAIL_USERNAME=…
MAIL_PASSWORD=…                 # Gmail app-password
```

Health probe: the container exposes `GET /api/v1/health` → `{status, database}`.

```yaml
# railway.json (optional; skip and just point at /backend)
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile", "context": "." },
  "deploy": {
    "healthcheckPath": "/api/v1/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Deploy: push repo, Railway detects `backend/Dockerfile`. Start command none (ENTRYPOINT in image).

---

## 3. Frontend — Vercel

Vercel project root = `frontend/`. `vercel.json` already handles the SPA rewrite.

Environment variables in the Vercel project:

| Var | Dev value | Example prod value |
|-----|-----------|--------------------|
| `VITE_API_URL` | `/api/v1` (relative, uses Vite proxy) | `https://<backend>.up.railway.app/api/v1` |
| `VITE_OAUTH_AUTHORIZATION_URL` | empty (uses proxy) | `https://<backend>.up.railway.app/oauth2/authorization/google` |
| `VITE_APP_NAME` | CareerOS | CareerOS |

Important: `VITE_*` vars are baked at build time. If backend URL changes, redeploy frontend.

Deploy: connect repo → root `frontend`, framework = Vite, build command `npm run build`,
output dir `dist`. (vercel.json sets these.)

---

## 4. OAuth2 in Google Cloud Console

Redirect URI (RAILWAY MUST EXACTLY MATCH):

```
https://<your-backend>.up.railway.app/login/oauth2/code/google
```

- Authorized origins: `https://<your-backend>.up.railway.app`
- JS origin: `https://<your-frontend-domain>` (if you also register web app — not required for
  server-side flow, but helps if you later enable openid).
- The backend uses `redirect-uri: "{baseUrl}/login/oauth2/code/google"` which resolves to the
  request host; Railway assigned domain must be the same host that the browser loaded (AUTHORIZED).

Production security: set `OAUTH_COOKIE_SECURE=true` (default true in `application-prod.yml`).

---

## 5. Env files — what not to commit

- `.env` and all `.env.*` ARE gitignored (`!.env.example` re-included).
- Only `.env.example` files (placeholders) are tracked.
- Add the real secrets to the hosting provider's dashboard (Railway variables / Vercel
  environment), never to a committed file.
- If `docker-compose.yml`'s old MySQL password ever existed in git history you should rotate it
  (see Appendix B).

---

## 6. First boot after deploy

1. Backend starts, Flyway runs `db/migration-pg` V1..V20 (creates tables). Watch Railway logs.
2. Admin account is created by `AdminSeeder` using `CAREEROS_ADMIN_EMAIL/PASSWORD`.
3. Health: `GET /api/v1/health` → 200 `{status":"UP",database":"UP"}`.
4. Test OAuth login from the frontend domain.

---

## 7. Local dev

```sh
; from repo root
docker compose up -d postgres qdrant n8n        # Postgres on :5432 (user careeros_user)
cp .env.example .env                           # fill DB_USER=careeros_user DB_PASSWORD=…
cd backend
..\backend\apache-maven-3.9.6\bin\mvn.cmd clean package -DskipTests
java -jar target/careeros-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev
cd ../frontend
npm install; npm run dev                        # http://localhost:3000
```

Or run `docker compose up --build backend frontend postgres qdrant` for the whole stack
(`http://localhost:3001`).

---

## 8. Security checklist (already applied)

- [x] No default/empty JWT secret in prod (fails fast)
- [x] CORS allowlist lifted from env (`CORS_ALLOWED_ORIGINS`) — no `*`
- [x] OAuth state cookie `Secure` when `OAUTH_COOKIE_SECURE=true` (prod default true)
- [x] Rate limiter now reads real client IP (`X-Forwarded-For` first entry) — no shared bucket
- [x] Health endpoint checks DB and returns 503 when down
- [x] Upload size/type/sanitizedName validation; `@CrossOrigin("*")` removed
- [x] Global exception handler no longer leaks `e.getMessage()` to clients
- [x] All secrets in `.env` files gitignored