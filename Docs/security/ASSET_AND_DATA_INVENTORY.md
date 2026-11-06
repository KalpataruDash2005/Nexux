# NEXORA — Enterprise-Grade SaaS Security Transformation
## Document 11: Asset & Sensitive Data Inventory

**Document Code:** NEXORA-DATA-001  
**Target:** Nexora SaaS Application (`https://nexoraos.space`)  
**Repository:** `KalpataruDash2005/Nexux`  
**Working Branch:** `security/enterprise-hardening`  
**Classification:** Confidential — Data Governance & Security  

---

## 1. Information Assets & Data Classification Standard

Nexora classifies data into three sensitivity tiers based on confidentiality, privacy, and regulatory risk:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      DATA CLASSIFICATION MATRIX                        │
├─────────────────┬──────────────────────────────────────────────────────┤
│ RESTRICTED      │ Highest sensitivity. Critical business/privacy harm. │
│ (Confidential)  │ Credentials, API keys, JWT secrets, PII, Resumes,    │
│                 │ Private student documents, Password hashes.          │
├─────────────────┼──────────────────────────────────────────────────────┤
│ INTERNAL        │ Operational platform data. Restricted to tenancy.    │
│                 │ Task lists, workspace metadata, job application      │
│                 │ statuses, interview chat histories, feedback logs.   │
├─────────────────┼──────────────────────────────────────────────────────┤
│ PUBLIC          │ Unrestricted public consumption.                     │
│                 │ Marketing copy, pricing plans, active job postings,  │
│                 │ health check responses.                              │
└─────────────────┴──────────────────────────────────────────────────────┘
```

---

## 2. Detailed Data Asset Inventory

| Asset Name | Primary Storage | Classification | Owner / Scope | Encryption at Rest | Encryption in Transit |
| :--- | :--- | :---: | :--- | :---: | :---: |
| **User Identity & Passwords** | Supabase PG (`users`) | **RESTRICTED** | Individual User | AES-256 (Supabase) | TLS 1.3 |
| **Student Profiles & PII** | Supabase PG (`student_profiles`) | **RESTRICTED** | Student User | AES-256 (Supabase) | TLS 1.3 |
| **Candidate Resumes (PDF & Text)**| Supabase PG & Supabase Storage | **RESTRICTED** | Candidate User | AES-256 (Supabase) | TLS 1.3 |
| **Academic Course Documents (PDF)**| Supabase Storage (`documents`) | **RESTRICTED** | Workspace Owner | AES-256 (Supabase) | TLS 1.3 |
| **Vector Chunks & Embeddings** | Qdrant Cloud (`careeros_pdf_chunks`)| **RESTRICTED** | Workspace Owner | AES-256 (Qdrant) | TLS 1.3 |
| **Interview Transcripts & Scores**| Supabase PG (`placement_sessions`)| **INTERNAL** | Student User | AES-256 (Supabase) | TLS 1.3 |
| **Student Algorithmic Code** | Ephemeral / Supabase PG | **INTERNAL** | Student User | Ephemeral / Supabase | TLS 1.3 |
| **Student Tasks & Study Plans** | Supabase PG (`tasks`) | **INTERNAL** | Student User | AES-256 (Supabase) | TLS 1.3 |
| **Job Postings** | Supabase PG (`jobs`) | **PUBLIC** | Recruiter / Global | AES-256 (Supabase) | TLS 1.3 |
| **Job Applications & Tracking**| Supabase PG (`applications`)| **RESTRICTED** | Candidate & Recruiter | AES-256 (Supabase) | TLS 1.3 |
| **User Feedback Submissions** | Supabase PG (`feedback_submissions`)| **INTERNAL** | Admin Only | AES-256 (Supabase) | TLS 1.3 |
| **Aptitude Sets & Questions** | Supabase PG (`aptitude_sets`) | **INTERNAL** | Platform Admin | AES-256 (Supabase) | TLS 1.3 |
| **Platform Secrets & API Keys** | Vercel Environment Variables | **RESTRICTED** | Platform DevOps | Encrypted (Vercel) | TLS 1.3 |

---

## 3. Data Flow & Third-Party Processor Mapping

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Vercel Inc.   │       │  Supabase Inc.  │       │   Qdrant Inc.   │
│ (Compute & Edge)│       │  (Postgres &    │       │ (Vector Cloud)  │
│                 │       │    Storage)     │       │                 │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         │                         │
         └────────────┬────────────┴────────────┬────────────┘
                      │                         │
                      ▼                         ▼
             ┌─────────────────┐       ┌─────────────────┐
             │  xAI Corp. /    │       │  Local Host /   │
             │   Grok LLM      │       │ Ephemeral Runner│
             │  (api.x.ai)     │       │  (Subprocess)   │
             └─────────────────┘       └─────────────────┘
```

### 3.1 Processor Security & Exposure Rules
1. **xAI Corporation (Grok API):**
   - **Data Transmitted:** Prompt text, extracted PDF excerpts, parsed resume text, student interview answers.
   - **Data NOT Transmitted:** User password hashes, database connection strings, JWT signing keys, system logs.
   - **Retention Boundary:** Processed per xAI API commercial terms without training on customer API data.
2. **Qdrant Cloud:**
   - **Data Transmitted:** 384-dimensional dense vectors and document text chunks (1,200 characters each).
   - **Isolation Requirement:** Vector records must be filtered strictly by `workspaceId` and verified against user ownership.
3. **Supabase Inc. (AWS us-east-1 / eu-central-1):**
   - **Data Transmitted:** Relational database records, raw binary PDF files.
   - **Isolation Requirement:** Row Level Security (RLS) must be enabled to prevent direct PostgREST table extraction.

---

## 4. Sensitive Operations & Privileged Actions

The following operations carry high security risk and require explicit authorization, input validation, and audit logging:

1. **Administrative Operations (`ADMIN` role required):**
   - `GET /api/v1/admin/users`: Exposes full user database inventory and email addresses.
   - `DELETE /api/v1/admin/feedback/{id}`: Permanent deletion of user feedback records.
   - `POST /api/v1/admin/aptitude/sets`: Upload and generation of platform-wide aptitude testing questions.
   - `DELETE /api/v1/admin/aptitude/sets/{setId}`: Deletion of standardized assessment sets.
2. **Recruiter Hiring Operations (`RECRUITER` role required):**
   - `GET /api/v1/applications/jobs/{jobId}`: Accesses candidate PII and application histories.
   - `PUT /api/v1/applications/{id}/status`: Mutates candidate employment outcomes.
3. **Student Code Evaluation (`STUDENT` role):**
   - `POST /api/v1/placement/coding/{id}/run`: Invokes code execution machinery. Must be strictly quarantined.
4. **File Operations (`STUDENT` role):**
   - `POST /api/v1/pdf-assistant/workspaces/{id}/documents`: Ingests binary files into serverless storage and vector pipeline.
