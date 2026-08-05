# CareerOS Planner — Multi-Agent Extraction Architecture

Production-ready reference for the AI Academic Calendar Extraction System:
the n8n multi-agent workflow, the database schema, the Spring Boot API surface,
React integration, and the reliability layers (validation, retry, error
handling, logging).

---

## 1. Architecture

```
User Uploads Calendar
        │  (backend POST /api/v1/planner/upload)
        ▼
n8n Webhook  POST /webhook/planner-calendar-extract
        ▼
1. Preprocess & OCR Agent
        ▼
2. Layout Detection Agent
        ▼
3. Grid Mapping Agent
        ▼
4. Month Detection Agent
        ▼
5. Date Mapping Agent
        ▼
6. Event Detection Agent
        ▼
7. Important Notes Agent
        ▼
8. Multi-Day Event Expansion Agent
        ▼
9. Validation Agent
        ▼
10. Merging Agent (dedupe + sort)
        ▼
11. JSON Formatter Agent
        ▼
12. Save & Study Planner Agent  ──►  POST /api/v1/planner/study-plan/generate
        ▼
Database (academic_events, planner_study_items)
        ▼
Dashboard (Today's Focus / Daily / Weekly / Monthly / Countdowns)
```

## 2. Runtime decision (important)

There are TWO interchangeable implementations of this architecture:

| Responsibility | n8n workflow (deliverable) | Active Java runtime (default) |
|---|---|---|
| Layout understanding | Agent 2 Layout Detection | `PlannerExtractionService` system prompt (STEP 1) |
| Sectioning / grid | Agents 3–5 Grid / Month / Date Mapping | `splitIntoSections` + per-section extractor subagents |
| Event + notes extraction | Agents 6–7 Event / Important Notes | section extractors + dedicated notes agent |
| Multi-day expansion | Agent 8 Expansion | `toDrafts` expansion (`MULTI_DAY_CATEGORIES`) |
| Validation | Agent 9 Validation | `validateAgainstSource`, `plausibleAddition`, `parseDate` |
| Merge / dedupe | Agent 10 Merging | `toDraftsMerged` (title+date dedupe, date sort) |
| JSON formatting | Agent 11 Formatter | `RawExtraction` / DTO mapping |
| Study plan | Agent 12 Study Planner | `PlannerStudyService.generateStudyPlan` |

The backend upload path currently uses the Java pipeline (proven, no external
dependency). The n8n workflow in `n8n/workflows/planner-calendar-extraction.json`
is ready to import and can become the primary path, or be called by the backend,
without touching any other service.

## 3. Database schema (MySQL, matches current Flyway schema)

`academic_events` — one row per event day:

| Column | Type | Notes |
|---|---|---|
| `id` | `VARCHAR(36)` PK | UUID |
| `owner_id` | `VARCHAR(36)` FK → `users` | owner |
| `title` | `VARCHAR(255)` NOT NULL | event title |
| `description` | `TEXT` | |
| `event_date` | `DATE` NOT NULL | multi-day events = one row per date |
| `start_time` / `end_time` | `TIME` NULL | |
| `category` | `VARCHAR(50)` NOT NULL | EXAM, INTERNAL_EXAM, EXTERNAL_EXAM, PRACTICAL_EXAM, ASSIGNMENT, SUBMISSION, PROJECT, HACKATHON, WORKSHOP, SEMINAR, HOLIDAY, FESTIVAL, VACATION, SPORTS, PLACEMENT, INDUSTRIAL_VISIT, ORIENTATION, CONVOCATION, CLASS, OTHER |
| `priority` | `VARCHAR(20)` NOT NULL | HIGH / MEDIUM / LOW |
| `color` | `VARCHAR(20)` | hex |
| `location` | `VARCHAR(255)` | |
| `semester` | `VARCHAR(100)` | |
| `completed` | `BOOLEAN` | |
| `needs_verification` | `BOOLEAN` | set when confidence < threshold |
| `ai_confidence` | `DOUBLE` | 0..1 |
| `source_file` | `VARCHAR(255)` | uploaded file name |
| `created_at` / `updated_at` | `DATETIME` | |

`planner_study_items` — generated study sessions:

| Column | Type |
|---|---|
| `id` | `VARCHAR(36)` PK |
| `owner_id` | FK → `users` |
| `plan_date` | `DATE` |
| `start_time` | `TIME` NULL |
| `subject` | `VARCHAR(255)` |
| `hours` | `DOUBLE` |
| `session_type` | `VARCHAR(50)` (STUDY / BREAK / …) |
| `completed` | `BOOLEAN` |
| `created_at` | `DATETIME` |

## 4. Spring Boot API surface (existing)

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/planner/upload` (multipart) | upload calendar → extraction → persist |
| `GET /api/v1/planner/events` | list/filter events |
| `GET/PATCH/DELETE /api/v1/planner/events/{id}` | single event CRUD |
| `DELETE /api/v1/planner/clear` | clear all events + study items |
| `GET /api/v1/planner/today` | today's focus |
| `GET /api/v1/planner/upcoming` | upcoming events |
| `GET /api/v1/planner/stats` | dashboard stats |
| `GET /api/v1/planner/study-plan` | generated plan |
| `POST /api/v1/planner/study-plan/generate` | (re)generate plan (used by n8n Agent 12) |
| `POST /api/v1/planner/regenerate` | alias for regenerate |

Intended (future) n8n callback contract — add only when switching runtime to n8n:

```
POST /api/v1/planner/n8n/results
Header: X-Internal-Key: <shared secret>
Body:   { "fileName": "...", "events": [ { title, date, category, priority, description, color, confidence } ] }
```

## 5. React integration (existing)

- `AiPlanner.tsx` — upload UI, event list, Clear button, daily schedule, upcoming.
- `Dashboard.tsx` — `TodayFocusCard`, `MiniCalendarCard`, `StudyProgressCard`
  (loaded from `/planner/today`, `/planner/stats`, `/planner/events`).
- `plannerService.ts` — all API calls; `uploadCalendar` returns imported count +
  warnings surfaced as toasts.

## 6. Reliability layers

- **Never hallucinate**: agents are instructed to only report dates written in
  the source; the Java runtime enforces it deterministically via
  `validateAgainstSource` (flat calendars: date must appear in text),
  `METADATA_TITLES` blocklist, and `plausibleAddition` near-duplicate guard.
- **Retry mechanism**: LLM calls retry on rate limits (parses `try again in Xs`,
  capped wait, exponential backoff, 5 attempts). Per-section extraction retries
  with corrective feedback (3 attempts) when JSON is invalid. n8n adds
  `onError`/retry settings per node when running that runtime.
- **Validation layer**: every date is parsed (`parseDate`, multiple formats);
  impossible dates are skipped with a warning; events below confidence are kept
  but flagged.
- **Error handling**: upload failures return friendly `BadRequestException`
  messages; partial failures surface as warnings in the upload response instead
  of failing the whole import.
- **Logging**: `PlannerExtractionService` / `PlannerStudyService` log LLM retries
  and OCR fallbacks (`log.warn`). n8n execution history is available in the n8n
  UI when that runtime is active.

## 7. Switching to the n8n runtime (future)

1. Import + activate `n8n/workflows/planner-calendar-extraction.json` (see
   `Docs/planner-n8n-agents.md`).
2. Add the internal callback endpoint above to `PlannerController`.
3. Point the backend upload flow at the n8n webhook (POST the extracted text) and
   persist the returned events. Keep the Java pipeline as the automatic fallback
   when n8n is unreachable.
