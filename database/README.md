# NEXAURA Database Migration & Schema Specification

This directory documents the relational schema, MySQL migration strategy, and initialization options for **NEXAURA / CareerOS** (FastAPI Deployment).

---

## 1. Schema Strategy

The database layer has been migrated to support **MySQL 8.0+** (default for local development with Docker) while maintaining compatibility with PostgreSQL and SQLite:

1. **`users`**: Central authentication table storing email, BCrypt password hashes, and user roles (`STUDENT`, `RECRUITER`, `ADMIN`).
2. **`student_profiles`**: 1-to-1 profile metadata associated with each student.
3. **`workspaces`**: User-owned learning and document workspaces.
4. **`documents`**: Ingested files, folders, and metadata.
5. **`pdf_documents`**: Ingested PDF and TXT documents, status tracking (`PENDING`, `PROCESSING`, `READY`, `FAILED`), chunk counts, and summaries.
6. **`pdf_chat_messages`**: PDF RAG chat history.
7. **`tasks`**: Task management with hierarchical task support, estimates, progress notes, and execution tracking.
8. **`ai_conversations` & `ai_memory`**: Long-term memory and context storage for the AI Task Assistant.
9. **`placement_resumes` & `placement_resume_analyses`**: ATS resume evaluations, JSON scorecards, and recommendations.
10. **`placement_sessions` & `placement_messages`**: Turn-by-turn interview simulations, scoring, coding challenges, and aptitude tests.
11. **`jobs` & `applications`**: Campus placement job board and application lifecycle.
12. **`feedback_submissions`**: Contact feedback and inquiries.
13. **`aptitude_sets` & `aptitude_questions`**: Curated MCQ question sets for aptitude tests.

---

## 2. Initializing Database

### Automatic Initialization (SQLAlchemy)
On startup, FastAPI automatically executes `init_db()` which checks and creates missing tables if they do not already exist, regardless of whether you are connecting to MySQL, PostgreSQL, or SQLite.

### Manual MySQL Initialization
To initialize directly via MySQL client or inside the Docker container:
```bash
mysql -h 127.0.0.1 -P 3307 -u careeros_user -pcareeros_pass careeros_db < schema-mysql.sql
```

When running `docker compose up -d` in `Nexaura-Deployment/`, `schema-mysql.sql` is automatically mounted to `/docker-entrypoint-initdb.d/01-schema.sql` and executed on first container creation.

### Files in this Directory
- `schema-mysql.sql`: Consolidated, verified MySQL 8.0 DDL schema (utf8mb4, InnoDB, strict foreign keys).
- `schema.sql`: Consolidated PostgreSQL DDL schema (for cloud Vercel deployments using Neon or Supabase).
