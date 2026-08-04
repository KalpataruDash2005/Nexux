# PDF Assistant — API & Architecture

Per-workspace PDF upload → AI summary + per-document Q&A, grounded strictly in
the uploaded file. Lives under the **Academic** section (`AcademicWorkspace.tsx`
→ "PDF Assistant" tab).

## Pipeline

```
Upload (multipart)
   └─ pdf_assistant_service.upload()
        ├─ saves file to app.pdf-assistant.storage-dir/{workspaceId}/{docId}.pdf
        ├─ inserts pdf_documents (status=PENDING)
        └─ async processAfterUpload()
             ├─ if app.pdf-assistant.n8n-enabled=true → POST /webhook/pdf-process
             │    (n8n stores chunks in Qdrant collection `careeros_pdf_chunks`
             │     then POSTs result to the internal endpoint below)
             └─ else / n8n unreachable → NATIVE fallback:
                  PDFBox text extraction (OCR fallback) → recursive split
                  → AllMiniLM-L6-v2 embeddings (384-dim) → Qdrant upsert
                  → Groq summary → status=READY
```

- **Chat** uses the backend NATIVE RAG path in all cases: embed the question with
  AllMiniLM-L6-v2 → search `careeros_pdf_chunks` filtered by `document_id`
  → Groq grounded answer. The n8n `pdf-chat` workflow is provided as an optional
  extension but is not called by the backend.
- **Delete** always runs native Qdrant cleanup (REST `points/delete` by
  `document_id` filter) + DB rows + stored file, and best-effort notifies n8n.

## Environment

| Variable (backend/.env) | Default | Meaning |
| --- | --- | --- |
| `PDF_ASSISTANT_N8N_ENABLED` | `true` | Route processing through n8n if reachable |
| `N8N_WEBHOOK_URL` | `http://localhost:5678` | n8n base URL used for webhook calls |
| `PDF_ASSISTANT_INTERNAL_KEY` | `careeros-pdf-internal` | Shared secret for internal callback |
| `PDF_ASSISTANT_STORAGE_DIR` | `./storage/pdf-assistant` | Where uploaded PDFs are stored |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | Groq | LLM for summary + chat |

### n8n dimension caveat

The native fallback and n8n share one Qdrant collection, `careeros_pdf_chunks`
(384-dim, Cosine). If your n8n embedding model produces anything other than
384-dim vectors (e.g. OpenAI `text-embedding-3-small` = 1536-dim), set
`PDF_ASSISTANT_N8N_ENABLED=false` so the native backend pipeline is used. The
`gsk_…` Groq key in `.env` has **no** `/embeddings` endpoint, so for the n8n path
you must supply a real embedding API key or a local sentence-transformers server.

## Auth

- All `/api/v1/pdf-assistant/**` endpoints require a Bearer JWT (identity = email).
- Ownership is enforced against `workspaces.owner_id`; a document is only
  accessible within its own workspace by its owner.

## Endpoints

### Upload
`POST /api/v1/pdf-assistant/workspaces/{workspaceId}/documents`
- `multipart/form-data`, field `file`, PDF only, ≤ 25 MB.
- 200 → `{ id, fileName, status: "PENDING", message }`. Processing is async;
  poll the list endpoint until `status` is `READY`/`FAILED`.

### List
`GET /api/v1/pdf-assistant/workspaces/{workspaceId}/documents`
- 200 → `PdfDocument[]` (newest first).

### Get one
`GET /api/v1/pdf-assistant/workspaces/{workspaceId}/documents/{documentId}`
- 200 → `PdfDocument`.

### Delete
`DELETE /api/v1/pdf-assistant/workspaces/{workspaceId}/documents/{documentId}`
- 204. Removes Qdrant vectors, chat messages, DB row, and stored file.

### Chat
`POST /api/v1/pdf-assistant/workspaces/{workspaceId}/documents/{documentId}/chat`
- Body `{ "question": "…" }`
- 200 → `{ answer, sources: [fileName], history: [{id, role, content, createdAt}] }`

### Chat history
`GET /api/v1/pdf-assistant/workspaces/{workspaceId}/documents/{documentId}/chat`
- 200 → `PdfChatMessage[]`.

### Internal result callback (n8n → backend)
`POST /api/v1/pdf-assistant/internal/result`
- Header `X-Internal-Key: <PDF_ASSISTANT_INTERNAL_KEY>` (required).
- Body: `{ documentId, status: "READY"|"FAILED", summary?, chunkCount?, error?, source?: "n8n" }`.
- PermitAll in `SecurityConfig`; guarded by the shared secret.
- 200 → `PdfDocument`; 404 if unknown `documentId`; 403 on bad key.

## Data model

- `pdf_documents` — id, workspace_id, owner_id, file_name, file_size,
  content_type, storage_key, status (PENDING/PROCESSING/READY/FAILED),
  processing_source (N8N/NATIVE), summary, chunk_count, error_message,
  processed_at, created_at. (migration `V14`)
- `pdf_chat_messages` — id, document_id, owner_id, role (USER/AI), content,
  created_at.

## n8n workflows (`n8n/workflows`)

Import into n8n and activate:
- `pdf-processing.json` — webhook `POST /webhook/pdf-process`. Receives
  `{ documentId, workspaceId, fileName, filePath, storageKey }`. Reads the PDF
  from the request **binary** (the backend currently sends JSON only, so a shared
  volume / binary attachment is required), splits + embeds + upserts into
  `careeros_pdf_chunks`, generates a summary, then POSTs the result to the
  internal endpoint.
- `pdf-chat.json` — optional RAG answerer on `POST /webhook/pdf-chat`.
- `pdf-delete.json` — deletes vectors by `document_id` on `POST /webhook/pdf-delete`.

`docker/docker-compose.yml` passes `N8N_*`, `QDRANT_URL`, `BACKEND_URL` and
`PDF_ASSISTANT_INTERNAL_KEY` into the `careeros-n8n` container.

## Frontend

- `src/services/pdfAssistantService.ts` — API client + types.
- `src/components/pdf-assistant/PdfAssistantPanel.tsx` — upload/list/status
  polling/summary/chat UI (auto-refreshes every 4 s while a document is
  PENDING/PROCESSING).
- `src/components/pdf-assistant/Markdown.tsx` — react-markdown + remark-gfm.
- `src/components/pdf-assistant/Toast.tsx` — lightweight toast provider.
- Entry point: `src/pages/AcademicWorkspace.tsx` "PDF Assistant" tab.

## Troubleshooting

- Document stays `PROCESSING` forever → backend couldn't reach n8n and native
  processing errored; check `backend-run.err.log`.
- Chat returns "couldn't find this information" → embeddings for that document
  are missing or dimension-mismatched (n8n vs native); keep a single 384-dim
  embedding model across both paths.
- Upload 500 with Flyway error → run `mvn -q flyway:migrate` or restart the
  backend (Flyway runs on startup).
