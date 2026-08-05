# AI Academic Planner — API Documentation

The AI Academic Planner extracts every important event from an uploaded academic
calendar (PDF or image), stores it as structured events, generates an AI study
plan, and powers the `/ai-planner` dashboard.

All endpoints are under `/api/v1/planner` and require a `Bearer` JWT.

---

## Endpoints

### Upload & extract calendar

`POST /api/v1/planner/upload` (multipart/form-data, field `file`)

Upload a **PDF, PNG, JPG, JPEG, WEBP or BMP** academic calendar. AI extracts
every event automatically, de-duplicates against existing events, flags
low-confidence entries for review, and regenerates the study plan.

```json
{
  "importedCount": 14,
  "duplicatesSkipped": 2,
  "needsVerification": 1,
  "semesterStart": "2026-08-01",
  "semesterEnd": "2026-12-20",
  "warnings": [],
  "events": [{ "id": "...", "title": "Mid Semester Exam", "date": "2026-09-15", ... }],
  "message": "14 events imported from academic_calendar.pdf, 2 duplicates skipped."
}
```

### List / search / filter events

`GET /api/v1/planner/events?category=EXAM&status=UPCOMING&q=java`

- `category` — one of `EXAM, INTERNAL_EXAM, EXTERNAL_EXAM, PRACTICAL_EXAM,
  ASSIGNMENT, SUBMISSION, PROJECT, HACKATHON, WORKSHOP, SEMINAR, HOLIDAY,
  FESTIVAL, VACATION, SPORTS, PLACEMENT, INDUSTRIAL_VISIT, ORIENTATION,
  CONVOCATION, CLASS, OTHER`
- `status` — `UPCOMING`, `COMPLETED`, `PENDING_VERIFICATION`
- `q` — free-text search over title, description, location and semester

Returns an array of `PlannerEventResponse`.

### Event CRUD

- `GET /api/v1/planner/events/{id}`
- `PATCH /api/v1/planner/events/{id}` — update any subset of
  `title, description, date, startTime, endTime, category, priority, color,
  location, semester, completed, needsVerification`
- `DELETE /api/v1/planner/events/{id}`

### Dashboard widgets

- `GET /api/v1/planner/today` → `TodayFocusResponse`
  `{ date, focus: [{ title, category, priority, color, date, daysRemaining,
  estimatedHours, recommendedHours, reason }], recommendations: [string] }`
- `GET /api/v1/planner/upcoming?range=TODAY|TOMORROW|WEEK|NEXT_WEEK`
- `GET /api/v1/planner/stats` → total / upcoming / completed / needs-review
  counts, events per category, and `studyProgress` per subject.

### Study plan & schedule

- `GET /api/v1/planner/study-plan` — the next 7 days of the generated plan.
- `POST /api/v1/planner/study-plan/generate` — (re)generate the AI plan.
  Body: `{ "days": 14 }` (optional, 1–60).
- `GET /api/v1/planner/schedule?date=YYYY-MM-DD` — a single day's schedule.
- `PATCH /api/v1/planner/schedule/sessions/{sessionId}?completed=true` — mark a
  study session complete/incomplete.

> `POST /api/v1/planner/regenerate` is kept as an alias of
> `/study-plan/generate` for compatibility.

---

## Event data structure

```json
{
  "id": "4f9a1c2e-...",
  "title": "TW Submission",
  "description": "Final tutorial work submission before the exam block.",
  "date": "2026-08-18",
  "startTime": null,
  "endTime": null,
  "category": "ASSIGNMENT",
  "priority": "HIGH",
  "color": "#f59e0b",
  "location": null,
  "semester": "Fall 2026",
  "completed": false,
  "needsVerification": false,
  "aiConfidence": 0.94,
  "daysRemaining": 3,
  "createdAt": "2026-08-04T10:00:00",
  "updatedAt": "2026-08-04T10:00:00"
}
```

---

## AI behaviour

- **PDFs** are parsed with Apache PDFBox / Tika (with Tesseract OCR fallback for
  scanned files), then sent to the configured text model for JSON extraction.
- **Images** are base64-encoded and sent to the configured vision model
  (`image_url` content). If the vision call fails (unavailable model / rate
  limit), the service automatically falls back to **Tesseract OCR**. OCR input
  is preprocessed (color-aware `min(R,G,B)` grayscale + upscale) so colored /
  highlighted exam text is still readable, then the same text-model extraction runs.
- **Week-based calendars are supported.** The extraction prompt recognises
  week-by-week layouts (e.g. `WEEK 6 (14-09-2026 to 19-09-2026)`) and converts
  each week's rows into concrete dated events using the week's own date range
  and stated weekdays. Key milestones (mid-sem / end-sem exams, internal
  assessments, assignments, submissions, holidays, placement drives) are
  hunted for even when buried inside weekly blocks.
- **Multi-day events** (e.g. `MID SEM EXAM 21-09 to 26-09`) are expanded into
  one event per day, so the daily schedule, today-focus and countdowns reflect
  the whole period. Only explicit two-date ranges are expanded — a single
  `FROM <date>` line stays a single-day event.
- Category labels are refined from the title (e.g. "Mid Sem Exam" →
  `INTERNAL_EXAM`, "End Sem Exam" → `EXTERNAL_EXAM`, "…Project…" → `PROJECT`).
- The LLM must return strict JSON (`semester_start`, `semester_end`, `events[]`)
  and is told **never to invent dates**.
- Events with confidence below `app.planner.min-confidence` (default `0.6`) are
  flagged `needsVerification` and surfaced on the dashboard for the student to
  confirm.
- The study plan prioritizes Exams → Assignments → Projects → Classes → Revision
  and uses the real subject names extracted from the calendar events.

## Configuration

| Property | Default |
| --- | --- |
| `app.planner.vision-model` | `llama-3.2-11b-vision-preview` |
| `app.planner.storage-dir` | `./storage/planner` |
| `app.planner.max-file-size` | `20971520` (20 MB) |
| `app.planner.default-plan-days` | `14` |
| `app.planner.min-confidence` | `0.6` |

LLM credentials are shared with the rest of the app via `app.openai.*`
(`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`).

## n8n workflows

Scheduled workflows live in `n8n/workflows/`:

- `academic-planner-morning.json` — every morning, fetches `/planner/today`,
  builds the focus message and posts it to `PLANNER_NOTIFY_WEBHOOK`.
- `academic-planner-night.json` — every night, regenerates the study plan via
  `/planner/study-plan/generate` and shares tomorrow's schedule.
- `academic-planner-reminders.json` — every hour, checks `/planner/upcoming` and
  sends reminders for today's exams/submissions/deadlines.

Workflows use `BACKEND_URL` and `PLANNER_BACKEND_TOKEN` for auth, and
`PLANNER_NOTIFY_WEBHOOK` as the pluggable notification destination. The backend
runs the entire feature natively, so the workflows are optional.
