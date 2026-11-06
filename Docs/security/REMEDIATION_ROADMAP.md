# NEXORA — Autonomous Red Team Security Audit
## Document 08: Prioritized Remediation Roadmap & Engineering Implementation Guide

**Assessment Code:** NEXORA-REDTEAM-001  
**Target:** Nexora SaaS Application (`https://nexoraos.space`)  
**Scope:** Remediation Strategy, Exact Code Fixes, Regression Testing, and Verification  
**Date:** November 2026  

---

## 1. Remediation Timeline & Priority Phases

```
┌────────────────────────────────────────────────────────────────────────┐
│                      REMEDIATION TIMELINE & PHASES                     │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ PHASE 1         │ PHASE 2          │ PHASE 3         │ PHASE 4         │
│ Critical Fixes  │ High Priority    │ Medium Priority │ Architectural   │
│ (0 - 48 Hours)  │ (Days 3 - 7)     │ (Week 2)        │ (Month 1)       │
├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
│ • NEX-VULN-001  │ • NEX-VULN-003   │ • NEX-VULN-006  │ • Sandboxed VM  │
│   (Admin Reg)   │   (BOLA Jobs)    │   (Vector BOLA) │   Code Runner   │
│ • NEX-VULN-005  │ • NEX-VULN-004   │ • NEX-VULN-007  │ • Redis Rate    │
│   (Hardcoded)   │   (CORS Vercel)  │   (URL Token)   │   Limiting      │
│ • Block Subproc │ • NEX-VULN-008   │ • NEX-VULN-010  │ • Cookie Auth   │
│   Code Exec     │   (Supabase RLS) │   (Headers)     │   Migration     │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

---

## 2. Phase 1: Immediate Critical Remediation (0 – 48 Hours)

---

### Step 1.1: Restrict Public Registration Role Whitelist (NEX-VULN-001)

**File:** `api/app/services/auth_service.py` (lines 23–29)

#### Proposed Code Patch:
```diff
--- a/api/app/services/auth_service.py
+++ b/api/app/services/auth_service.py
@@ -23,7 +23,7 @@ class AuthService:
         requested_role = (request.role or "STUDENT").upper()
-        if requested_role not in ("STUDENT", "RECRUITER", "ADMIN"):
+        if requested_role not in ("STUDENT", "RECRUITER"):
             raise HTTPException(
                 status_code=status.HTTP_400_BAD_REQUEST,
                 detail="Role must be STUDENT or RECRUITER"
             )
```

#### Verification & Regression Test:
Execute `pytest api/tests/test_auth.py` with a new test case:
```python
def test_register_admin_role_rejected(client: TestClient):
    payload = {"email": "attacker@evil.com", "password": "Password123!", "role": "ADMIN"}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "Role must be STUDENT or RECRUITER" in response.json()["detail"]
```

---

### Step 1.2: Enforce Mandatory `JWT_SECRET` & Remove Insecure Defaults (NEX-VULN-005)

**File:** `api/app/core/config.py` (lines 52–55, 131–133)

#### Proposed Code Patch:
```diff
--- a/api/app/core/config.py
+++ b/api/app/core/config.py
@@ -52,6 +52,6 @@ class Settings(BaseSettings):
-    JWT_SECRET: str = Field(
-        default="careeros-super-secret-jwt-key-with-at-least-256-bits-length-for-security-purposes!",
-        description="JWT Secret for HMAC-SHA256"
-    )
+    JWT_SECRET: str = Field(..., min_length=32, description="Mandatory JWT Secret for HMAC-SHA256")
@@ -131,3 +131,3 @@ class Settings(BaseSettings):
     CAREEROS_ADMIN_EMAIL: str = "admin@nexora.app"
-    CAREEROS_ADMIN_PASSWORD: Optional[str] = "Admin@12345"
+    CAREEROS_ADMIN_PASSWORD: Optional[str] = None
```

#### Verification:
Verify the application throws a validation error on startup if `JWT_SECRET` is unset, preventing silent fallback to insecure defaults.

---

### Step 1.3: Disable Host Subprocess Execution on Production / Serverless (NEX-VULN-002)

**File:** `api/app/services/code_execution_service.py` (lines 170–180)

#### Interim Safe Mitigation:
Until a dedicated isolated microVM service (e.g. Vercel Sandbox / Judge0) is deployed, prevent arbitrary subprocess execution in production:
```diff
--- a/api/app/services/code_execution_service.py
+++ b/api/app/services/code_execution_service.py
@@ -176,6 +176,14 @@ class CodeExecutionService:
         lang = cls.normalize_language(language)
+        # Block direct host execution on production serverless instances
+        if os.getenv("VERCEL") == "1" or os.getenv("ENVIRONMENT") == "production":
+            return (
+                False,
+                "",
+                "Host code execution is disabled in this environment. Isolated sandbox evaluation required.",
+                "Compilation Error",
+                0.0
+            )
```

---

## 3. Phase 2: High-Priority Fixes (Days 3 – 7)

---

### Step 2.1: Enforce Recruiter Ownership on Job Applications (NEX-VULN-003)

**File:** `api/app/services/job_service.py` (lines 98–147)

#### Proposed Code Patch:
```diff
--- a/api/app/services/job_service.py
+++ b/api/app/services/job_service.py
@@ -101,6 +101,11 @@ class JobService:
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
 
+        if job.posted_by_id != user.id and user.role.upper() != "ADMIN":
+            raise HTTPException(
+                status_code=status.HTTP_403_FORBIDDEN,
+                detail="Access denied: You do not own this job posting"
+            )
+
         apps = self.repo.get_applications_by_job(job_id)
@@ -128,6 +133,12 @@ class JobService:
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
 
+        job = self.repo.get_by_id(app.job_id)
+        if not job or (job.posted_by_id != user.id and user.role.upper() != "ADMIN"):
+            raise HTTPException(
+                status_code=status.HTTP_403_FORBIDDEN,
+                detail="Access denied: You cannot modify applications for this job"
+            )
+
         app.status = status_val.upper()
```

#### Verification & Regression Test:
Add a test verifying that Recruiter B receives HTTP 403 when trying to access or mutate applications for Recruiter A's job.

---

### Step 2.2: Restrict CORS Regex to Trusted Domains (NEX-VULN-004)

**File:** `api/app/main.py` (lines 76–77)

#### Proposed Code Patch:
```diff
--- a/api/app/main.py
+++ b/api/app/main.py
@@ -76,2 +76,2 @@ origins = settings.cors_origins_list
-    allow_origin_regex=r"https?://.*" if origins == ["*"] else r"https?://(.*\.)?(nexoraos\.space|nexora\.space|vercel\.app|localhost|127\.0\.0\.1)(:\d+)?",
+    allow_origin_regex=r"^https://(www\.)?(nexoraos\.space|nexora\.space)$|^https://nexora-[a-z0-9]+-kalpatarudash2005s-projects\.vercel\.app$|^http://(localhost|127\.0\.0\.1)(:\d+)?$",
```

#### Verification:
Send preflight OPTIONS request with `Origin: https://malicious.vercel.app`. Verify that `Access-Control-Allow-Origin` is omitted.

---

### Step 2.3: Enable Row Level Security (RLS) on Supabase PostgreSQL (NEX-VULN-008)

**Execution Location:** Supabase SQL Editor / Migration Script

#### Proposed Migration DDL:
```sql
-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_resume_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aptitude_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE aptitude_questions ENABLE ROW LEVEL SECURITY;

-- Revoke direct anon/authenticated PostgREST access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
```

---

## 4. Phase 3: Medium-Priority Fixes (Week 2)

---

### Step 3.1: Enforce Workspace Ownership on Vector Search (NEX-VULN-006)

**File:** `api/app/api/routes/workspace_routes.py` (lines 162–166)

#### Proposed Code Patch:
```diff
--- a/api/app/api/routes/workspace_routes.py
+++ b/api/app/api/routes/workspace_routes.py
@@ -162,5 +162,7 @@
-@router.get("/{workspaceId}/search")
-def search_workspace(workspaceId: str, query: str = "", current_user: User = Depends(get_current_user)):
+@router.get("/{workspaceId}/search")
+def search_workspace(workspaceId: str, query: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
+    service = WorkspaceService(db)
+    service.get_workspace(workspaceId, current_user)  # Throws 404 if not owned
     from app.rag.pipeline import rag_pipeline
     hits = rag_pipeline.search_context(workspaceId, query, top_k=5)
     return hits
```

---

### Step 3.2: Remove Token from URL Query Parameters (NEX-VULN-007)

**File:** `api/app/api/routes/pdf_assistant_routes.py` (lines 58–77)

#### Proposed Code Patch:
```diff
--- a/api/app/api/routes/pdf_assistant_routes.py
+++ b/api/app/api/routes/pdf_assistant_routes.py
@@ -58,16 +58,10 @@ router = APIRouter(prefix="/pdf-assistant", tags=["PDF Assistant"])
 @router.get("/workspaces/{workspaceId}/documents/{documentId}/file")
 def get_pdf_document_file(
     workspaceId: str,
     documentId: str,
-    token: Optional[str] = Query(None),
-    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
+    current_user: User = Depends(get_current_user),
     db: Session = Depends(get_db)
 ):
-    raw_token = None
-    if credentials and credentials.credentials:
-        raw_token = credentials.credentials
-    elif token:
-        raw_token = token
```

---

### Step 3.3: Configure HTTP Security Headers in `vercel.json` (NEX-VULN-010)

**File:** `vercel.json`

#### Proposed Code Patch:
```diff
--- a/vercel.json
+++ b/vercel.json
@@ -15,4 +15,19 @@
+  "headers": [
+    {
+      "source": "/(.*)",
+      "headers": [
+        { "key": "X-Content-Type-Options", "value": "nosniff" },
+        { "key": "X-Frame-Options", "value": "DENY" },
+        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
+        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
+        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
+      ]
+    }
+  ],
   "routes": [
```

---

## 5. Phase 4: Long-Term Architectural Enhancements (Month 1)

1. **Deploy Dedicated Code Execution MicroVMs:**
   Migrate coding execution to Vercel Sandboxes (ephemeral Firecracker microVMs) or an isolated Judge0 API cluster with zero network access and hard memory limits.
2. **Distributed Redis Rate Limiter:**
   Replace the in-memory dictionary rate limiter with an Upstash Redis rate limiter to enforce API quotas consistently across serverless instances.
3. **Session Token Cookie Migration:**
   Transition frontend token storage from `localStorage` to `HttpOnly`, `SameSite=Strict`, `Secure` cookies to eliminate token theft via potential XSS vectors.
4. **Prompt Delimiter Sandboxing:**
   Implement structural `<untrusted_content>` tags across all LLM prompt assembly routines to prevent prompt injection.
