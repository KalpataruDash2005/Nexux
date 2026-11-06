# NEXORA — Autonomous Red Team Security Audit
## Document 07: Infrastructure, Configuration & Secrets Security Audit

**Assessment Code:** NEXORA-REDTEAM-001  
**Target:** Nexora SaaS Application (`https://nexoraos.space`)  
**Scope:** Vercel Hosting, Serverless Runtime, CORS, Security Headers, Git History, and Secrets Management  
**Date:** November 2026  

---

## 1. Hosting Architecture & Vercel Serverless Topology

Nexora is deployed on the Vercel platform using a hybrid frontend-backend configuration governed by `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "builds": [
    { "src": "api/index.py", "use": "@vercel/python" },
    { "src": "frontend/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/index.py" },
    { "src": "/health", "dest": "api/index.py" },
    { "src": "/assets/(.*)", "dest": "frontend/assets/$1" },
    { "src": "/((?!api|health).*)", "dest": "frontend/index.html" }
  ]
}
```

### Runtime Environment Analysis
- **Execution Model:** AWS Lambda / Firecracker microVM managed under Vercel Serverless Function architecture.
- **Python Version:** Python 3.12 (`@vercel/python`).
- **Filesystem Permissions:** The root filesystem is read-only except for the `/tmp` directory (up to 512 MB – 1024 MB temporary storage).
- **Execution Lifespan:** Ephemeral serverless invocations with maximum execution timeouts (typically 10s to 60s depending on Vercel tier).
- **Implications for In-Memory State:** Global variables (such as `InMemoryRateLimiter._history` and `qdrant_service._in_memory_store`) are preserved only across warm invocations of the same container instance. They are not shared across concurrently running serverless instances.

---

## 2. CORS Configuration & Wildcard Regex Vulnerability (NEX-VULN-004)

### 2.1 Configuration Review
In `api/app/main.py`:
```python
origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_origin_regex=r"https?://.*" if origins == ["*"] else r"https?://(.*\.)?(nexoraos\.space|nexora\.space|vercel\.app|localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2.2 Security Flaw Analysis
1. **The Vulnerable Regex:** `r"https?://(.*\.)?(nexoraos\.space|nexora\.space|vercel\.app|localhost|127\.0\.0\.1)(:\d+)?"`
2. **Evaluation:** The pattern `(.*\.)?vercel\.app` matches:
   - Legitimate deployment preview domains: `nexora-git-main-kalpatarudash2005s-projects.vercel.app`
   - **ANY attacker-controlled domain hosted on Vercel:** `https://evil-hacker.vercel.app`, `https://phishing-site.vercel.app`, etc.
3. **Exploitation:** An attacker registers a free Vercel account, deploys a static web page on `attacker.vercel.app`, and sends an authenticated fetch request to `https://nexoraos.space/api/v1/students/me`. Because `allow_credentials=True`, the browser allows the attacker's script to read sensitive profile and workspace data.

---

## 3. HTTP Security Headers Audit (NEX-VULN-010)

Inspection of `vercel.json` revealed that **no HTTP security headers** are configured. The following essential headers are missing from production responses:

| Header | Current State | Risk | Recommended Value |
| :--- | :--- | :--- | :--- |
| **Strict-Transport-Security** | Missing | Man-in-the-Middle (MitM) / SSL Stripping | `max-age=63072000; includeSubDomains; preload` |
| **X-Content-Type-Options** | Missing | MIME-type sniffing / script execution | `nosniff` |
| **X-Frame-Options** | Missing | Clickjacking in iframes | `DENY` |
| **Referrer-Policy** | Missing | Leakage of URL paths/tokens to external origins | `strict-origin-when-cross-origin` |
| **Permissions-Policy** | Missing | Unrestricted browser API access | `camera=(), microphone=(), geolocation=()` |
| **Content-Security-Policy** | Missing | Cross-Site Scripting (XSS) / Data exfiltration | Restrictive script/connect/object sources |

---

## 4. Git Repository History & Secrets Handling

### 4.1 `.gitignore` & `.vercelignore` Review
- `.gitignore` properly excludes:
  - `.env`, `.env.*`, `**/.env`, `**/.env.*` (with exception for `!.env.example`)
  - `node_modules/`, `dist/`, `build/`
  - `__pycache__/`, `*.pyc`, `.pytest_cache/`
  - `Nexaura-SpringBoot/backend/target/`
- `.vercelignore` properly excludes heavy development assets (`frontend/node_modules/`, `database/`, `.pytest_cache/`, `scripts/`, `Docs/`).

### 4.2 Git Commit History Audit
- An audit of the git history (`git log -p`) was conducted.
- No production database passwords, live Supabase secret service-role keys, or active xAI provider tokens were committed in plaintext in the tracked commit history.
- Commit `2c67e70` introduced the broadened CORS regular expression to resolve local development and preview origin errors, inadvertently opening the `*.vercel.app` vulnerability.

### 4.3 Environment Variable Exposure in Frontend Build
- `frontend/src/services/apiClient.ts` references:
  `baseURL: import.meta.env.VITE_API_URL || '/api/v1'`
- In Vite, only variables prefixed with `VITE_` are bundled into frontend client code.
- No private backend secrets (such as `JWT_SECRET`, `SUPABASE_SECRET_KEY`, or `XAI_API_KEY`) are prefixed with `VITE_`.
- Frontend environment variable isolation is properly maintained.

---

## 5. Logging & Error Sanitization Audit

### 5.1 Centralized Exception Sanitizer
In `api/app/core/error_handler.py`:
- `sanitize_error_detail` checks all exception messages against `_LEAK_PATTERNS`.
- The regex automatically detects database errors (`OperationalError`, `ProgrammingError`, `psycopg2`, `pymysql`), SQL syntax strings (`SELECT ... FROM`), internal class names, stack traces, and sensitive keywords (`password_hash`, `jwt_secret`, `xai-*`).
- If an exception matches or has status code >= 500, a safe user-facing message is substituted (e.g. `"Your document could not be processed. Please check the file and try again."`) alongside an opaque `requestId` correlation ID.
- **Assessment:** Exception masking is well implemented and effectively prevents database query leakage and stack trace exposure to API consumers.

---

## 6. Dependency Vulnerability Analysis

A review of Python dependencies in `api/requirements.txt` was conducted:
- `fastapi==0.115.8` / `starlette==0.45.3` / `pydantic==2.10.6`: Modern releases with patched security advisories.
- `PyJWT==2.10.1`: Current release resistant to algorithm confusion (`alg: none`) when algorithms are explicitly specified.
- `bcrypt==4.3.0`: Current release.
- `pypdf==5.3.1`: Pure-Python PDF parser.
- `qdrant-client==1.13.2`: Modern client library.

---

## 7. Recommendations for Infrastructure & Secrets

1. **Harden `vercel.json` with Security Headers:**
   Add standard security headers to all static and API routes.
2. **Restrict CORS Regex:** Replace `*.vercel.app` with exact production domains and authorized preview project slugs.
3. **Fail-Fast on Missing Environment Variables:**
   Modify `Settings` in `api/app/core/config.py` to raise a `ValueError` on startup if `JWT_SECRET` is unset or equals default placeholder values.
4. **Distribute Rate Limiting State:** Transition from in-memory sliding window rate limiting to an external key-value store (Upstash Redis or Supabase table) to enforce rate limits across distributed serverless instances.
