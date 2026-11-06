# NEXORA — Enterprise-Grade SaaS Security Transformation
## Document 10: Security Baseline & Compliance Benchmark

**Document Code:** NEXORA-BASE-001  
**Target:** Nexora SaaS Application (`https://nexoraos.space`)  
**Repository:** `KalpataruDash2005/Nexux`  
**Working Branch:** `security/enterprise-hardening`  
**Classification:** Confidential — Security Engineering Baseline  

---

## 1. Executive Baseline Assessment

Prior to the commencement of the security transformation, Nexora exhibited significant security features (e.g. BCrypt hashing, centralized error masking, and ORM parameterization) alongside **severe architectural vulnerabilities** that exposed the platform to full administrative takeover, host compromise, and cross-tenant data leakage.

### Security Posture Scorecard (Current Baseline vs. Enterprise Target)

| Domain | Current Baseline Grade | Target Enterprise Grade | Primary Gap / Risk |
| :--- | :---: | :---: | :--- |
| **Identity & Authentication** | **D+** | **A** | Public admin role assignment; hardcoded default JWT secret. |
| **Authorization & Multi-Tenancy**| **D** | **A+** | BOLA in job applications and vector search; missing ownership verification. |
| **Code Execution Sandbox** | **F** | **A** | Raw `subprocess.run` on host OS without microVM/container isolation. |
| **Database Security** | **C-** | **A** | Supabase PostgreSQL tables lack Row Level Security (RLS) policies. |
| **API & Web Security** | **C** | **A** | CORS allows arbitrary `*.vercel.app`; zero HTTP security headers in `vercel.json`. |
| **AI & RAG Security** | **C+** | **A-** | Prompt injection via unescaped resume/PDF chunks; no vector owner tags. |
| **File Storage Security** | **B-** | **A** | Extension-only validation; public storage fallback possibility. |
| **Monitoring & Incident Response**| **C** | **A** | Correlation IDs present, but missing dedicated security audit event stream. |

---

## 2. Alignment with Industry Security Standards

### 2.1 OWASP Top 10 (2021) Baseline Mapping

| OWASP Category | Vulnerability ID in Nexora | Current Status | Remediation Roadmap Phase |
| :--- | :--- | :---: | :---: |
| **A01:2021 — Broken Access Control** | NEX-VULN-001 (Admin Reg), NEX-VULN-003 (BOLA Jobs), NEX-VULN-006 (BOLA Search) | **CRITICAL FAIL** | Phase 1 & Phase 3 |
| **A02:2021 — Cryptographic Failures** | NEX-VULN-005 (Default JWT Secret), NEX-VULN-007 (Token in URL) | **FAIL** | Phase 1 & Phase 2 |
| **A03:2021 — Injection** | NEX-VULN-002 (Host RCE via code exec), NEX-VULN-011 (Prompt Inj) | **CRITICAL FAIL** | Phase 1 & Phase 8 |
| **A04:2021 — Insecure Design** | NEX-VULN-002 (Lack of sandbox architecture), NEX-VULN-009 (No session revocation) | **FAIL** | Phase 1 & Phase 9 |
| **A05:2021 — Security Misconfiguration**| NEX-VULN-004 (CORS Vercel regex), NEX-VULN-008 (No Supabase RLS), NEX-VULN-010 (Headers) | **FAIL** | Phase 2, 4, 6 |
| **A06:2021 — Vulnerable Components** | All Python packages updated, pypdf evaluated | **PASS** | Phase 11 |
| **A07:2021 — Identification & Auth Failures**| NEX-VULN-005 (Default password `Admin@12345`), NEX-VULN-009 (Logout leaves JWT valid) | **FAIL** | Phase 1 & Phase 2 |
| **A08:2021 — Software & Data Integrity**| Untrusted student code executed under host runtime | **CRITICAL FAIL** | Phase 1 & Phase 9 |
| **A09:2021 — Security Logging Failures**| Sanitization active, but security events (unauthorized access, admin actions) unlogged | **PARTIAL** | Phase 12 |
| **A10:2021 — SSRF** | Unsandboxed Python subprocess can initiate arbitrary outbound HTTP requests to metadata | **CRITICAL FAIL** | Phase 1 & Phase 9 |

---

### 2.2 OWASP API Security Top 10 (2023) Baseline Mapping

| API Security Risk | Affected Nexora Endpoint | Current State | Target State |
| :--- | :--- | :---: | :---: |
| **API1:2023 — Broken Object Level Auth** | `GET /applications/jobs/{id}`, `GET /workspaces/{id}/search` | **FAIL** | Enforce strict entity ownership check on every query. |
| **API2:2023 — Broken Authentication** | `POST /auth/register`, `api/app/core/config.py` | **FAIL** | Enforce strict role whitelist; mandatory cryptographic JWT secret. |
| **API3:2023 — Broken Object Property Auth** | `RegisterRequestDto.role` allows `"ADMIN"` | **FAIL** | Strip privileged properties from public request schemas. |
| **API4:2023 — Unrestricted Resource Consumption**| AI endpoints (`/chat`, `/analyze`) lack rate limiting | **FAIL** | Implement distributed per-user rate limits and token ceilings. |
| **API5:2023 — Broken Function Level Auth** | Public registration transitions user to administrative privileges | **FAIL** | Strictly isolate admin provisioning to private CLI / migrations. |
| **API7:2023 — Server-Side Request Forgery** | Subprocess execution can hit `http://169.254.169.254/` | **FAIL** | Ephemeral sandbox with network namespace disabled. |
| **API8:2023 — Security Misconfiguration** | CORS allows `*.vercel.app` with `allow_credentials=True` | **FAIL** | Restrict CORS to exact production domains. |

---

### 2.3 OWASP Top 10 for LLM Applications (2025) Baseline Mapping

| LLM Risk | Component | Observed Vulnerability | Target Mitigation |
| :--- | :--- | :--- | :--- |
| **LLM01: Prompt Injection** | `analyze_resume`, `ask_question` | Untrusted PDF and resume text concatenated directly into prompts. | Delimiter isolation (`<untrusted_content>`) & system prompt reinforcement. |
| **LLM02: Sensitive Info Disclosure** | AI Gateway | API keys masked in logs; error handler masks tokens. | Maintained and enforced. |
| **LLM04: Model Denial of Service** | PDF summary, workspace chat | No per-user AI rate limits; high token consumption. | Implement per-minute AI request quotas and token caps. |
| **LLM06: Excessive Agency** | Code execution engine | LLM evaluating submissions combined with raw host execution. | Isolate code execution completely from AI agent context. |

---

## 3. Baseline Security Controls Inventory

### Positive Controls Already Active
1. **Centralized Error Sanitization (`api/app/core/error_handler.py`):**
   - Automatically masks internal database exceptions, class names, query syntax, and credentials before returning JSON responses to clients.
   - Attaches an opaque `requestId` correlation ID to every response for backend trace correlation.
2. **Parameterized Database Layer (`api/app/repositories/`):**
   - Repository pattern strictly utilizes SQLAlchemy ORM query methods without raw SQL string concatenation.
   - First-order SQL injection vectors are absent across core repositories.
3. **Password Security (`api/app/core/security.py`):**
   - BCrypt hashing with standard salt generation and 72-byte truncation.
4. **File Size Enforcement (`api/app/services/pdf_assistant_service.py`):**
   - Enforces a 4.5 MB file ceiling matching Vercel serverless request body constraints.

### Critical Gaps Requiring Immediate Remediation
1. **Administrative Access Boundary:** Self-assignment of `"ADMIN"` role in `AuthService.register_user`.
2. **Host Isolation:** Raw `subprocess.run` execution of untrusted user code in `CodeExecutionService.execute_in_sandbox`.
3. **Secret Rigor:** Hardcoded fallback values for `JWT_SECRET` and admin password in `Settings`.
4. **CORS Regex:** Wildcard `(.*\.)?vercel\.app` with credentialed CORS.
5. **Database RLS:** Complete absence of PostgreSQL Row Level Security on Supabase.
