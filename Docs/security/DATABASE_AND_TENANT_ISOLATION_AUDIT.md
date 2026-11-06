# NEXORA — Autonomous Red Team Security Audit
## Document 05: Database & Tenant Isolation Security Audit

**Assessment Code:** NEXORA-REDTEAM-001  
**Target:** Nexora SaaS Application (`https://nexoraos.space`)  
**Scope:** Relational Database (Supabase PostgreSQL), Vector Store (Qdrant Cloud), Object Storage, and SQL Security  
**Date:** November 2026  

---

## 1. Database Architecture & Connectivity

Nexora utilizes PostgreSQL hosted on Supabase as its primary operational datastore, with backwards compatibility for MySQL and SQLite in local development environments.

### Connection Topology & Connection Pooling
- **Connection Configuration:** Defined in `api/app/core/config.py` and instantiated in `api/app/core/database.py`.
- **Drivers Supported:** `psycopg2`, `psycopg` (binary), `pymysql`, `sqlite3`.
- **Pool Settings:**
  - `DB_POOL_SIZE`: 5
  - `DB_MAX_OVERFLOW`: 10
  - `DB_POOL_PRE_PING`: True (verifies connection validity prior to checkout)
  - `DB_POOL_RECYCLE`: 300 seconds (mitigates stale connections behind Vercel serverless / Supabase Transaction Pooler)
- **SSL Enforcement:** For Supabase PostgreSQL, `sslmode=require` is enforced dynamically during engine creation.

---

## 2. Row Level Security (RLS) Analysis on Supabase

### 2.1 Complete Absence of Row Level Security Policies (NEX-VULN-008)
The PostgreSQL schema (`database/schema-supabase.sql`) creates 20 tables:
1. `users`
2. `student_profiles`
3. `jobs`
4. `applications`
5. `workspaces`
6. `documents`
7. `summaries`
8. `flashcards`
9. `quizzes`
10. `quiz_questions`
11. `tasks`
12. `ai_conversations`
13. `ai_memory`
14. `pdf_documents`
15. `pdf_chat_messages`
16. `placement_resumes`
17. `placement_resume_analyses`
18. `placement_sessions`
19. `placement_messages`
20. `feedback_submissions`
21. `aptitude_sets`
22. `aptitude_questions`

**Audit Finding:**  
Not a single table in the schema executes `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`.

### 2.2 Attack Vector via Supabase PostgREST Data API
In default Supabase project deployments:
1. Supabase automatically exposes an HTTP REST API powered by PostgREST at `https://<project-ref>.supabase.co/rest/v1/`.
2. This API accepts requests authenticated via the Supabase public `anon` key.
3. When Row Level Security is NOT enabled on a table, PostgreSQL treats all tables as accessible to the `anon` and `authenticated` roles based on table grant privileges.
4. If the Supabase project’s public schema grants read/write permissions to `anon`, any attacker who obtains the project URL and `anon` key can query:
   - `GET https://<project-ref>.supabase.co/rest/v1/users` -> Dumps all user password hashes and emails.
   - `GET https://<project-ref>.supabase.co/rest/v1/placement_resumes` -> Dumps all candidate resumes.
   - `DELETE https://<project-ref>.supabase.co/rest/v1/tasks` -> Deletes all student tasks.

---

## 3. SQL Query Construction & SQL Injection (SQLi) Audit

All relational database operations in Nexora are mediated through SQLAlchemy ORM repositories (`api/app/repositories/`):
- `user_repository.py`
- `workspace_repository.py`
- `pdf_document_repository.py`
- `task_repository.py`
- `job_repository.py`
- `admin_repository.py`

### 3.1 Static Code Audit of Queries
Every query was inspected for dynamic string concatenation, raw SQL formatting (`f"SELECT ... {input}"`), or unsanitized `text()` clauses:
- Repository methods use standard SQLAlchemy query construction:
  ```python
  self.db.query(Task).filter(Task.user_id == user_id, Task.status == status_filter).all()
  self.db.query(PdfDocument).filter(PdfDocument.id == doc_id, PdfDocument.owner_id == owner_id).first()
  ```
- No raw SQL string interpolation was found.
- All query parameters are properly bound and escaped through SQLAlchemy's parameterized execution layer.
- **Conclusion:** The application demonstrates strong resilience against traditional first-order and second-order SQL injection attacks.

---

## 4. Supabase Storage Bucket Security

### 4.1 Storage Architecture
- **Service:** Supabase Object Storage (`https://<project-ref>.supabase.co/storage/v1/object/`)
- **Bucket:** Configured via `SUPABASE_STORAGE_BUCKET`, defaulting to `"documents"`.
- **Backend Key:** Authenticated using `settings.effective_supabase_key` (`SUPABASE_KEY` or `SUPABASE_SECRET_KEY`).

### 4.2 Storage Fallback Observation in `pdf_assistant_service.py`
In `_download_from_supabase_storage`:
```python
# 1. Direct object download with Authorization header
url = f"{base_url}/storage/v1/object/{bucket}/{filename}"
res = requests.get(url, headers=headers, timeout=12.0)
if res.status_code == 200 and res.content:
    return res.content

# 2. Public download endpoint
pub_url = f"{base_url}/storage/v1/object/public/{bucket}/{filename}"
pub_res = requests.get(pub_url, timeout=12.0)
if pub_res.status_code == 200 and pub_res.content:
    return pub_res.content
```
- **Finding:** The backend attempts to download files from `/object/public/{bucket}/{filename}` if the authenticated endpoint fails.
- **Risk:** If the administrator configures the `documents` bucket as **Public** in the Supabase dashboard (to simplify client-side viewing), all uploaded student PDFs (syllabi, proprietary notes, homework solutions) become publicly readable by anyone who knows or discovers the filename storage key (`{workspace_id}_{uuid}.pdf`).
- **Remediation:** The `documents` bucket must remain **strictly Private** in Supabase Storage, and downloads must require signed service credentials.

---

## 5. Qdrant Vector Store Multi-Tenant Isolation

### 5.1 Vector Payload Schema
In `api/app/vectorstore/qdrant_service.py`, document chunks are embedded using 384-dimensional dense vectors and upserted into Qdrant collection `careeros_pdf_chunks`:
```python
payload = {
    "workspaceId": workspace_id,
    "documentId": document_id,
    "chunkIndex": idx,
    "text": text
}
```

### 5.2 Filter Mechanics & Isolation Analysis
Vector search queries in Qdrant apply a keyword filter:
```python
must_conditions = [
    models.FieldCondition(key="workspaceId", match=models.MatchValue(value=workspace_id))
]
if document_id:
    must_conditions.append(
        models.FieldCondition(key="documentId", match=models.MatchValue(value=document_id))
    )
```

### 5.3 Isolation Weakness & Cross-Tenant Retrieval
1. **Absence of User ID in Vector Payload:** The vector points store `workspaceId` and `documentId`, but **do NOT store `ownerId` or `userId`**.
2. **Consequence:** Qdrant itself has no concept of user ownership. It relies entirely on the calling FastAPI application to verify that the requesting user owns the `workspaceId` before calling `qdrant_service.search`.
3. **Exploitation via BOLA (NEX-VULN-006):** In `api/app/api/routes/workspace_routes.py`, `GET /workspaces/{workspaceId}/search` fails to verify that the current user owns `workspaceId`. Because Qdrant only filters on `workspaceId`, any authenticated user who calls this endpoint with another student's `workspaceId` will retrieve all vector chunks and extracted text belonging to that student.

---

## 6. Summary of Recommendations for Database & Storage

1. **Enable PostgreSQL Row Level Security:**
   Execute on Supabase PostgreSQL:
   ```sql
   DO $$
   DECLARE
       r RECORD;
   BEGIN
       FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
           EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
           EXECUTE 'REVOKE ALL ON public.' || quote_ident(r.tablename) || ' FROM anon, authenticated;';
       END LOOP;
   END $$;
   ```
2. **Restrict Supabase Storage Bucket:** Ensure the `documents` bucket is explicitly configured as `public = false`.
3. **Include `ownerId` in Vector Payloads:** Add `"ownerId": user_id` to Qdrant vector point payloads, and enforce `ownerId` matching in all vector retrieval queries as a defense-in-depth measure.
