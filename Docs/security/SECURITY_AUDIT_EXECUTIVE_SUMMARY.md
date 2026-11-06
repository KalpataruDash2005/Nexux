# NEXORA — Autonomous Red Team Security Audit
## Document 01: Executive Summary & Assessment Overview

**Assessment Code:** NEXORA-REDTEAM-001  
**Target:** Nexora Autonomous SaaS Platform  
**Production URL:** `https://nexoraos.space`  
**Target Repository:** `KalpataruDash2005/Nexux` (`main` branch)  
**Assessor:** Senior Red Team Security Engineer & Application Security Researcher  
**Methodology:** Zero-Downtime Controlled Assessment (Static Code Analysis, Architecture Inspection, Threat Modeling, Defensive Configuration Verification)  
**Date:** November 2026  
**Assessment Status:** Discovery & Vulnerability Identification Complete (Mission 001)

---

## 1. Executive Summary

A comprehensive, non-destructive red team security assessment and code audit was conducted on the Nexora application codebase. The assessment covered the complete multi-tenant SaaS architecture, including the React/TypeScript frontend, FastAPI Python backend, Supabase PostgreSQL database integration, Qdrant vector retrieval engine, xAI Grok AI provider routing, and Vercel serverless deployment topology.

The objective was to identify security weaknesses across authentication, authorization, multi-tenant isolation, remote code execution boundaries, AI/RAG integrations, database security, and infrastructure configuration without causing service disruption or compromising real user data.

### High-Level Posture Overview

| Severity Category | Confirmed Vulnerabilities | Architecture / Config Concerns | Total Findings |
| :--- | :---: | :---: | :---: |
| **Critical** | 2 | 0 | **2** |
| **High** | 3 | 1 | **4** |
| **Medium** | 4 | 2 | **6** |
| **Low / Informational** | 3 | 2 | **5** |
| **Total** | **12** | **5** | **17** |

The audit revealed that while Nexora features strong centralized error-masking (`sanitize_error_detail`) and clean separation of concerns, **two critical vulnerabilities** pose immediate systemic risks to application integrity and host infrastructure:

1. **Unrestricted Administrative Registration (Critical):** The public user registration endpoint (`POST /api/v1/auth/register`) explicitly permits any anonymous user to supply `role: "ADMIN"` in the JSON payload, granting immediate, unauthenticated privilege escalation to full platform administration.
2. **Unsandboxed Host Code Execution (Critical):** The algorithmic coding evaluation engine (`POST /api/v1/placement/coding/{id}/run`) executes student-submitted Python and JavaScript code via raw `subprocess.run` directly on the host operating system without containerization, microVM isolation (gVisor/Firecracker), filesystem restrictions, or network namespace isolation.

In addition, high-severity vulnerabilities were identified in the **Cross-Origin Resource Sharing (CORS)** configuration (which permits arbitrary `*.vercel.app` origins with credentials), **Broken Object-Level Authorization (BOLA/IDOR)** in job application access, **hardcoded default JWT secrets and admin passwords**, and **missing Row Level Security (RLS)** across all Supabase PostgreSQL tables.

---

## 2. Risk Matrix

```
       ┌─────────────────────────────────────────────────────────────┐
       │                       IMPACT SEVERITY                       │
┌──────┼──────────────┬──────────────┬──────────────┬────────────────┤
│      │ Low          │ Medium       │ High         │ Critical       │
├──────┼──────────────┼──────────────┼──────────────┼────────────────┤
│ High │ NEX-VULN-009 │ NEX-VULN-006 │ NEX-VULN-003 │ NEX-VULN-001   │
│ Prob │ (Token in LS)│ (Vector BOLA)│ (BOLA Jobs)  │ (Public Admin) │
│      │              │ NEX-VULN-007 │ NEX-VULN-004 │ NEX-VULN-002   │
│      │              │ (Token in URL│ (CORS Vercel)│ (Host RCE)     │
├──────┼──────────────┼──────────────┼──────────────┼────────────────┤
│ Med  │ NEX-VULN-010 │ NEX-VULN-008 │ NEX-VULN-005 │                │
│ Prob │ (Headers)    │ (No RLS)     │ (Default JWT)│                │
│      │              │ NEX-VULN-011 │              │                │
│      │              │ (Prompt Inj) │              │                │
├──────┼──────────────┼──────────────┼──────────────┼────────────────┤
│ Low  │ NEX-VULN-012 │              │              │                │
│ Prob │ (Unauth Notif│              │              │                │
└──────┴──────────────┴──────────────┴──────────────┴────────────────┘
```

---

## 3. Top Critical & High Findings Summary

### NEX-VULN-001: Public Self-Registration Privilege Escalation to ADMIN
- **Severity:** Critical (CVSS 4.0: 9.8)
- **Component:** `api/app/services/auth_service.py` (`register_user`)
- **Impact:** Any internet user can register with `{"role": "ADMIN"}` and gain full administrative privileges to inspect all registered users, delete feedback, modify aptitude question sets, and view all recruiter jobs.

### NEX-VULN-002: Host-Level Remote Code Execution via Coding Sandbox Escape
- **Severity:** Critical (CVSS 4.0: 9.4)
- **Component:** `api/app/services/code_execution_service.py` (`execute_in_sandbox`)
- **Impact:** The code execution engine uses `subprocess.run([sys.executable, "solution.py"], ...)` in a basic temporary directory without OS-level sandboxing. An attacker can read the entire server filesystem (including `.env` credentials, database URLs, and API keys), open outbound network connections to internal cloud metadata or external command-and-control servers, or exhaust host compute resources.

### NEX-VULN-003: Broken Object-Level Authorization (BOLA/IDOR) in Candidate Applications
- **Severity:** High (CVSS 4.0: 8.5)
- **Component:** `api/app/services/job_service.py` (`get_applications_for_job`, `update_application_status`)
- **Impact:** Any user registered with role `RECRUITER` can retrieve the full names, emails, and submission records of applicants for any job posting across all employers, and can unilaterally mutate hiring application statuses without ownership verification.

### NEX-VULN-004: Over-Permissive Wildcard CORS Allowing Arbitrary `*.vercel.app` Origins with Credentials
- **Severity:** High (CVSS 4.0: 7.1)
- **Component:** `api/app/main.py` (`CORSMiddleware`)
- **Impact:** The backend regex allows any origin matching `https?://(.*\.)?vercel\.app` with `allow_credentials=True`. An attacker hosting a free static site on Vercel can initiate cross-origin authenticated requests against `nexoraos.space` to extract private user data.

### NEX-VULN-005: Fallback to Hardcoded JWT Signing Secret & Default Admin Account
- **Severity:** High (CVSS 4.0: 8.2)
- **Component:** `api/app/core/config.py` (`JWT_SECRET`, `CAREEROS_ADMIN_PASSWORD`)
- **Impact:** The application codebase contains a static default `JWT_SECRET` string. If environment variables are ever omitted or unconfigured during preview or container runs, any attacker can forge arbitrary HS256 tokens. Furthermore, startup lifecycle logic automatically seeds `admin@nexora.app` with default password `Admin@12345`.

---

## 4. Assessment Scope & Boundaries

### Included in Scope
- **Backend Source Code:** FastAPI route controllers, dependency injection, service layer, repositories, SQLAlchemy ORM models, configuration classes, and AI gateway modules under `api/app/`.
- **Frontend Source Code:** React 18, TypeScript, Axios API clients, context providers, routing guards, and Markdown components under `frontend/src/`.
- **Database & Storage DDL:** PostgreSQL schemas, tables, relationships, and constraints in `database/`.
- **Vector Retrieval Architecture:** Qdrant Cloud client integration, payload schemas, and similarity search pipelines in `api/app/vectorstore/` and `api/app/rag/`.
- **Serverless & Deployment Configuration:** `vercel.json`, `.vercelignore`, `.gitignore`, environment variable templates (`.env.example`).

### Excluded / Prohibited (Strict Zero-Downtime Rule)
- Direct denial-of-service (DoS) or volume flooding of `https://nexoraos.space`.
- Execution of harmful payloads or unauthorized file exfiltration on production instances.
- Deletion or modification of production customer records or database tables.
- Attacks on third-party SaaS infrastructure (Supabase, Vercel, Qdrant Cloud, xAI).

---

## 5. Report Structure & Roadmap

This security assessment is documented across the following structured deliverables in `docs/security/`:

1. `SECURITY_AUDIT_EXECUTIVE_SUMMARY.md` *(This Document)* — Overview, scorecards, risk matrix.
2. `ATTACK_SURFACE_MAP.md` — Complete inventory of routes, trust boundaries, sensitive data flows, and assets.
3. `VULNERABILITY_REGISTER.md` — Formal vulnerability register with CVSS 4.0 scores, root causes, evidence, and safe reproductions.
4. `AUTHENTICATION_AUTHORIZATION_AUDIT.md` — In-depth analysis of JWT, session management, RBAC, and BOLA/IDOR findings.
5. `DATABASE_AND_TENANT_ISOLATION_AUDIT.md` — Multi-tenant boundaries, RLS analysis, SQL injection resistance, and Supabase security.
6. `AI_AND_RAG_SECURITY_AUDIT.md` — Prompt injection analysis, Qdrant collection isolation, and AI gateway credential handling.
7. `INFRASTRUCTURE_AND_SECRETS_AUDIT.md` — Vercel serverless configurations, CORS, security headers, `.env` handling, and dependencies.
8. `REMEDIATION_ROADMAP.md` — Step-by-step prioritized remediation plan with code fixes and regression test recommendations.
