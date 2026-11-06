# NEXORA — Autonomous Red Team Security Audit
## Document 04: Authentication & Authorization Security Audit

**Assessment Code:** NEXORA-REDTEAM-001  
**Target:** Nexora SaaS Application (`https://nexoraos.space`)  
**Scope:** Identity Lifecycle, Token Mechanics, RBAC, and Multi-Tenant Access Controls  
**Date:** November 2026  

---

## 1. Authentication Architecture & Token Lifecycle

Nexora utilizes JSON Web Tokens (JWT) for stateless authentication. Tokens are signed using the HMAC-SHA256 (`HS256`) algorithm.

### Token Issuance Flow
1. **Endpoint:** `POST /api/v1/auth/login`
2. **Input:** `AuthRequestDto` (`email`, `password`)
3. **Password Verification:** Passwords are verified against stored hashes using `bcrypt.checkpw(password_bytes[:72], hash_bytes)`.
4. **Token Generation (`create_access_token`):**
   ```python
   to_encode = {
       "sub": str(subject),       # User email
       "iat": datetime.utcnow(),
       "exp": expire,             # Default: 24 hours (86,400,000 ms)
   }
   encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
   ```
5. **Client Handling:** Returned in `AuthResponseDto` (`token`, `type: "Bearer"`, `email`, `role`, `name`). The client stores the token in `window.localStorage`.

---

## 2. Authentication Weaknesses & Findings

### 2.1 Hardcoded JWT Secret Default (NEX-VULN-005)
- **Location:** `api/app/core/config.py` (lines 52–55)
- **Analysis:** The `Settings` class provides a hardcoded fallback string for `JWT_SECRET`:
  `"careeros-super-secret-jwt-key-with-at-least-256-bits-length-for-security-purposes!"`
- **Risk:** If an administrator or automated CI/CD pipeline deploys a preview or test environment without populating the `JWT_SECRET` environment variable, the server defaults to this public key. Any attacker can generate forged tokens with `{"sub": "admin@nexora.app"}` and achieve full administrative compromise.

### 2.2 Lack of Server-Side Session Invalidation (NEX-VULN-009)
- **Location:** `api/app/core/security.py`, `frontend/src/context/AuthContext.tsx`
- **Analysis:** Nexora has no token blacklist, revocation list, or database session table.
- **Client Logout:**
  ```typescript
  const logout = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/auth');
  };
  ```
- **Risk:** Logout is strictly a client-side deletion. An active JWT token remains valid on the backend for up to 24 hours. If an attacker intercepts or steals a token (e.g. via XSS or browser history), logging out does not terminate the attacker's session.

### 2.3 Token Leakage in URL Parameters (NEX-VULN-007)
- **Location:** `api/app/api/routes/pdf_assistant_routes.py` (lines 58–70) & `frontend/src/pages/OAuth2Callback.tsx` (lines 20–28)
- **Analysis:** In `get_pdf_document_file`, the API allows authentication via query parameter `?token=...`:
  ```python
  @router.get("/workspaces/{workspaceId}/documents/{documentId}/file")
  def get_pdf_document_file(..., token: Optional[str] = Query(None), credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
      raw_token = credentials.credentials if (credentials and credentials.credentials) else token
  ```
- **Risk:** Query parameters are routinely logged in plaintext by reverse proxies, Vercel edge access logs, browser history, and HTTP `Referer` headers when viewing embedded resources.

### 2.4 Account Enumeration During Registration & Login
- **Registration:** Calling `POST /api/v1/auth/register` with an existing email returns HTTP 400 with `{"detail": "Email is already in use!"}`.
- **Login:** Calling `POST /api/v1/auth/login` with an invalid user returns `{"detail": "Invalid email or password"}`.
- **Assessment:** Login resists user enumeration (good practice), but registration explicitly leaks whether an email address exists in the system.

### 2.5 Password Hashing Evaluation
- **Algorithm:** BCrypt with standard gensalt (`bcrypt.hashpw(password.encode('utf-8')[:72], bcrypt.gensalt())`).
- **Evaluation:** BCrypt is an industry-standard, slow hashing function with adaptive cost. Truncation to 72 bytes matches standard BCrypt specification. Password hashing implementation is sound.

---

## 3. Authorization & Role-Based Access Control (RBAC)

Nexora defines three application roles: `STUDENT`, `RECRUITER`, and `ADMIN`.

### RBAC Implementation in `api/app/api/dependencies.py`
```python
def require_role(allowed_roles: list[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.upper() not in [r.upper() for r in allowed_roles] and current_user.role.upper() != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires role in {allowed_roles}",
            )
        return current_user
    return role_checker

get_current_student = require_role(["STUDENT"])
get_current_recruiter = require_role(["RECRUITER"])
get_current_admin = require_role(["ADMIN"])
```

### RBAC Evaluation Matrix
| Role | Intended Capabilities | Observed Enforcement | Vulnerability / Bypass |
| :--- | :--- | :--- | :--- |
| `STUDENT` | Create workspaces, upload study PDFs, take coding practice, manage tasks, apply to jobs. | Enforced on profile & tasks. | **BOLA in workspace search allows cross-student document retrieval.** |
| `RECRUITER`| Post jobs, view applicants for their own jobs, update application statuses. | Enforced by role check. | **BOLA allows viewing and altering applications for ALL recruiters' jobs.** |
| `ADMIN` | Manage users, view platform metrics, manage aptitude sets, delete feedback. | Enforced by `require_role(["ADMIN"])`. | **CRITICAL: Public self-registration allows any user to become `ADMIN`.** |

---

## 4. Multi-Tenant Isolation & BOLA / IDOR Analysis

Multi-tenancy in Nexora relies entirely on SQL query filtering at the application layer rather than database-level Row Level Security (RLS) or tenant schema separation.

### Detailed Object-Level Authorization Audit by Subsystem

#### 1. Workspace Subsystem
- `GET /api/v1/workspaces`: Filters by `owner_id == user.id` in repository. **Secure.**
- `GET /api/v1/workspaces/{id}`: Calls `get_by_id_and_owner(id, user.id)`. **Secure.**
- `PATCH /api/v1/workspaces/{id}`: Validates ownership before update. **Secure.**
- `DELETE /api/v1/workspaces/{id}`: Validates ownership before delete. **Secure.**
- `POST /api/v1/workspaces/{id}/chat`: Validates workspace ownership via `get_workspace`. **Secure.**
- `GET /api/v1/workspaces/{id}/search`: **VULNERABLE (BOLA / IDOR).** Directly queries vector store using `workspaceId` without checking if `user.id == workspace.owner_id`. Any student can search another student's workspace documents.

#### 2. PDF Documents & Chat Subsystem
- `POST /api/v1/pdf-assistant/workspaces/{id}/documents`: Validates workspace ownership before upload. **Secure.**
- `GET /api/v1/pdf-assistant/workspaces/{id}/documents`: Filters by workspace and owner. **Secure.**
- `GET /api/v1/pdf-assistant/workspaces/{id}/documents/{docId}`: Validates ownership. **Secure.**
- `DELETE /api/v1/pdf-assistant/workspaces/{id}/documents/{docId}`: Validates ownership before deletion. **Secure.**
- `POST /api/v1/pdf-assistant/workspaces/{id}/documents/{docId}/chat`: Validates ownership. **Secure.**

#### 3. Tasks & Study Planner Subsystem
- `GET /api/v1/tasks`: Filters by `user_id == user.id`. **Secure.**
- `POST /api/v1/tasks`: Assigns `user_id = user.id`. **Secure.**
- `GET /api/v1/tasks/{id}`: Validates `user_id == user.id`. **Secure.**
- `PATCH /api/v1/tasks/{id}`: Validates `user_id == user.id`. **Secure.**
- `DELETE /api/v1/tasks/{id}`: Validates `user_id == user.id`. **Secure.**

#### 4. Placement, Resumes & Coding Subsystem
- `POST /api/v1/placement/resume/analyze`: Attaches resume to `user.id`. **Secure.**
- `GET /api/v1/placement/resumes`: Filters by `owner_id == user.id`. **Secure.**
- `GET /api/v1/placement/sessions/{id}`: Validates session ownership. **Secure.**
- `POST /api/v1/placement/coding/{id}/run`: Validates session ownership, but **VULNERABLE to Host RCE** via unsandboxed subprocess execution.

#### 5. Jobs & Applications Subsystem
- `POST /api/v1/jobs`: Assigns `posted_by_id = user.id`. **Secure.**
- `GET /api/v1/applications/me`: Filters by `student_id == user.id`. **Secure.**
- `GET /api/v1/applications/jobs/{jobId}`: **VULNERABLE (BOLA / IDOR).** Any recruiter can retrieve candidate applications for any job posted by any other recruiter.
- `PUT /api/v1/applications/{id}/status`: **VULNERABLE (BOLA / IDOR).** Any recruiter can update the status of any application across the platform.

---

## 5. Summary of Authentication & Authorization Recommendations

1. **Fix Registration Whitelist:** Restrict public registration strictly to `STUDENT` and `RECRUITER`. Deny `ADMIN` registration unconditionally.
2. **Enforce Job Application Ownership:** In `JobService`, verify that `job.posted_by_id == user.id` before returning applications or modifying status.
3. **Enforce Workspace Ownership on Search:** Call `WorkspaceService.get_workspace(workspaceId, current_user)` before querying `rag_pipeline.search_context`.
4. **Remove URL Query Parameter Auth:** Remove `?token=` from `/file` endpoints and mandate `Authorization: Bearer` headers.
5. **Implement Session Revocation:** Introduce a `token_version` on `User` or a token revocation store, and implement a true server-side `/auth/logout` endpoint.
