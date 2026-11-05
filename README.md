# NEXORA / CareerOS — Production Deployment (FastAPI + React + Supabase + Qdrant Cloud)

This is the official **Production Deployment Branch** (`Deployment`) for **Nexora / CareerOS**.

It contains the verified full-stack implementation optimized for production hosting on **Vercel**, **Supabase PostgreSQL**, **Qdrant Cloud**, and **xAI Grok**.

---

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────┐
│               Client Browser / Custom Domain           │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│     React + Vite SPA    │  │     FastAPI Backend     │
│  (Vercel Static Build)  │  │ (Python Serverless/Host) │
│  Relative API: /api/v1  │  │   Uvicorn / ASGI Core   │
└─────────────────────────┘  └───────────┬─────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────┐
│ Supabase PostgreSQL  │  │        Qdrant Cloud         │  │     xAI Grok API        │
│ Port 5432 / 6543     │  │  384-dim Dense Vector Store │  │ Workload Model Routing  │
│ 38 Normalized Tables │  │  Cosine Distance Collection │  │ PDF, Chat, Resume, Code │
└──────────────────────┘  └─────────────────────────────┘  └─────────────────────────┘
```

| Component | Technology | Target Deployment | Role |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons | Vercel Static Build (`dist/`) | Interactive student portal, academic workspace, placement hub |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic | Vercel Python Runtime (`api/index.py`) / Docker | High-performance REST API, auth, document ingestion, tasks |
| **Relational DB** | PostgreSQL 15+ / MySQL 8.0 | Supabase PostgreSQL | Users, workspaces, documents, flashcards, job apps, analytics |
| **Vector DB** | Qdrant Cloud | Qdrant Managed Cluster | Document chunk embeddings, semantic RAG search |
| **AI Provider** | xAI Grok (Grok-2, Grok-2-mini) | xAI REST API | Long-context PDF analysis, conversational assistant, code grading |
| **Object Storage** | Supabase Storage / Local Disk | Supabase Bucket (`documents`) | Multi-page PDF binary persistence and viewing |

---

## 2. Directory Structure

```text
.
├── api/                             # Python FastAPI Backend
│   ├── app/
│   │   ├── ai/                      # xAI Grok gateway & workload routing
│   │   ├── api/routes/              # REST route controllers (/auth, /workspaces, /pdf-assistant, etc.)
│   │   ├── core/                    # Security, logging, database engine, caching, config
│   │   ├── document_processing/     # PyPDF text extraction & character chunking
│   │   ├── embeddings/              # 384-dim embedding service (FastEmbed ONNX with fallback)
│   │   ├── models/                  # SQLAlchemy 2.0 unified ORM models
│   │   ├── rag/                     # RAG pipeline with grounded semantic retrieval
│   │   ├── repositories/            # Transactional database query layer
│   │   ├── schemas/                 # Pydantic validation models & API contracts
│   │   ├── services/                # Business logic (tasks, interviews, code grader)
│   │   └── vectorstore/             # Qdrant client & collection management
│   ├── tests/                       # 80 unit & integration test suites
│   ├── Dockerfile                   # Container definition for containerized hosting
│   ├── entrypoint.sh                # Startup health verification script
│   ├── index.py                     # Vercel Serverless Function entrypoint
│   └── requirements.txt             # Python dependencies
│
├── frontend/                        # React 18 + Vite SPA
│   ├── src/                         # Components, pages, hooks, contexts, services
│   ├── public/                      # Static assets, branding, demo visuals
│   ├── Dockerfile                   # NGINX alpine container for frontend
│   ├── nginx.conf                   # Reverse proxy configuration
│   ├── package.json                 # Node dependencies
│   ├── vercel.json                  # Vite SPA rewrite rules
│   └── vite.config.ts               # Bundling & chunking configuration
│
├── database/                        # Database Schemas & Migrations
│   ├── schema-supabase.sql          # Idempotent PostgreSQL DDL for Supabase SQL Editor
│   ├── schema.sql                   # Standard consolidated PostgreSQL schema
│   ├── schema-mysql.sql             # MySQL 8.0 schema for local Docker Compose
│   └── README.md                    # Database documentation
│
├── docker-compose.yml               # Local single-command start (MySQL + Qdrant + Backend + Frontend)
├── vercel.json                      # Unified Vercel monorepo deployment descriptor
├── .env.example                     # Environment variable template with documentation
├── .gitignore                       # Safeguards credentials, cache, virtualenvs, uploads
└── README.md                        # This documentation
```

---

## 3. Local Development with Docker Compose

To run the complete verified stack locally with zero configuration:

```bash
# 1. Copy the environment template
cp .env.example .env

# 2. Add your xAI Grok API key to .env
# XAI_API_KEY=xai-...

# 3. Start all services with one command
docker compose up --build
```

Access services locally:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
- **Qdrant Web UI**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

---

## 4. Production Deployment Setup

### Step 1: Supabase PostgreSQL Setup
1. Create a project at [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase project dashboard.
3. Open `database/schema-supabase.sql`, paste its contents into the SQL Editor, and click **Run**.
4. Obtain your connection strings from **Project Settings -> Database**:
   - **Transaction Pooler (Port 6543)** *(Recommended for Vercel Serverless)*:
     `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require`
   - **Direct Connection (Port 5432)**:
     `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### Step 2: Supabase Storage Bucket Setup (for PDFs)
1. In Supabase, navigate to **Storage -> New Bucket**.
2. Name the bucket `documents`. Set it to **Private** (or Public with read-only access).
3. Obtain your **Supabase URL** and **Service Role Key** (or Anon Key) from **Project Settings -> API**.

### Step 3: Qdrant Cloud Setup
1. Create a cluster at [Qdrant Cloud](https://cloud.qdrant.io).
2. Obtain your **Cluster URL** (e.g., `https://xyz-example.eu-central.aws.cloud.qdrant.io:6333`) and **API Key**.
3. The application will automatically create the `careeros_pdf_chunks` collection (384-dimensional cosine index) upon first connection.

### Step 4: Vercel Project Configuration
1. In your Vercel Dashboard, connect to this GitHub repository on branch `Deployment`.
2. Configure the following **Environment Variables** in Vercel (**Settings -> Environment Variables**):

| Variable Name | Example / Format | Required | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require` | **Yes** | Supabase connection string |
| `JWT_SECRET` | `replace-with-a-random-64-char-hex-string` | **Yes** | HMAC-SHA256 JWT secret |
| `XAI_API_KEY` | `xai-your-api-key` | **Yes** | Shared or default xAI Grok key |
| `XAI_MODEL_PDF` | `grok-2-1212` | No | Long-context model for PDF RAG |
| `XAI_MODEL_CHAT` | `grok-2-mini` | No | Fast latency model for chat |
| `QDRANT_URL` | `https://xyz.cloud.qdrant.io:6333` | **Yes** | Qdrant Cloud Cluster URL |
| `QDRANT_API_KEY` | `your-qdrant-api-key` | **Yes** | Qdrant Cloud API key |
| `QDRANT_USE_TLS` | `true` | **Yes** | Enable HTTPS/TLS for Qdrant Cloud |
| `SUPABASE_URL` | `https://[PROJECT-REF].supabase.co` | No | Enables Supabase Storage for PDFs |
| `SUPABASE_KEY` | `your-supabase-service-role-key` | No | Supabase API key for object storage |
| `SUPABASE_STORAGE_BUCKET` | `documents` | No | Supabase storage bucket name |
| `CAREEROS_ADMIN_EMAIL` | `admin@nexora.app` | No | Initial admin email account |
| `CAREEROS_ADMIN_PASSWORD` | `YourSecurePassword123!` | No | Initial admin account password |

3. Click **Deploy**. Vercel will build both the frontend static assets and the serverless Python functions as specified in `vercel.json`.

---

## 5. Verification & Testing

All backend APIs, RAG pipelines, and AI evaluation services are accompanied by an automated pytest suite in `api/tests/`.

To run the complete test suite locally:
```bash
pytest api/tests/ -v
```
All 80 test suites pass across:
- Authentication & JWT issuance/verification
- Workload model routing & failover resilience
- Grounded RAG retrieval & natural conversational answering
- Interview assessment accuracy
- Python code execution & correctness validation
- Task planner transactional workflows
