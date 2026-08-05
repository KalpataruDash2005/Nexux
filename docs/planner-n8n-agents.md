# CareerOS Planner — n8n Multi-Agent Calendar Extraction (Agent Prompts & Run Guide)

This workflow (`n8n/workflows/planner-calendar-extraction.json`) implements the
multi-agent academic calendar extraction architecture as an n8n orchestration.
Each agent has exactly ONE responsibility and is implemented as an n8n **Code**
node that calls the LLM (Groq via the n8n container environment) with a dedicated
system prompt, then passes a growing context object to the next agent.

> Runtime note: the **active** upload path in the backend is the in-process Java
> multi-agent pipeline (`PlannerExtractionService`), which implements the same
> agent responsibilities in Java and is the default runtime. This n8n workflow is
> the orchestration deliverable — import it into n8n when you want the
> extraction to run as an n8n pipeline instead.

---

## 1. Environment variables (n8n container)

The workflow reads these from the n8n container environment (already present for
the PDF assistant workflows):

| Variable | Example | Purpose |
|---|---|---|
| `N8N_LLM_BASE_URL` | `https://api.groq.com/openai/v1` | LLM endpoint |
| `N8N_LLM_API_KEY` | `gsk_...` | LLM API key |
| `N8N_LLM_MODEL` | `llama-3.1-8b-instant` | LLM model |
| `PLANNER_OCR_URL` | optional `http://...` | OCR endpoint called when an image is posted instead of text |
| `PLANNER_BACKEND_URL` | `http://backend:8081` (in docker) / `http://localhost:8081` | used by the Save & Study Planner agent to regenerate the study plan |

## 2. Import & activate

1. Open n8n: `http://localhost:5678`
2. **Workflows → Import from File** → select `n8n/workflows/planner-calendar-extraction.json`
3. If you want it live, open the workflow and toggle **Active**. The webhook URL is
   `POST http://localhost:5678/webhook/planner-calendar-extract`.

## 3. Webhook request contract

```jsonc
{
  "text": "OCR / PDF text of the academic calendar (>= 40 chars)", // OR
  "base64Image": "<base64>",       // only when PLANNER_OCR_URL is configured
  "mimeType": "image/png",          // optional, for OCR
  "fileName": "calendar.pdf",       // optional
  "token": "<jwt>",                 // optional: needed to auto-regenerate the study plan
  "regenerateStudyPlan": true       // optional: calls POST /api/v1/planner/study-plan/generate
}
```

## 4. Webhook response

```jsonc
{
  "events": [
    {
      "id": "", "title": "End Semester Examination", "description": "",
      "category": "EXAM", "priority": "HIGH", "date": "2026-11-20",
      "day": "20", "month": "November", "year": "2026", "source": "Calendar", "confidence": 99
    }
  ],
  "fileName": "calendar.pdf",
  "studyPlanStatus": 200,      // only when regenerateStudyPlan=true + token provided
  "studyPlan": { ... }
}
```

## 5. Agent prompts (one responsibility each)

### Agent 1 — Preprocess & OCR (no LLM)
Normalizes input: accepts OCR text directly, or runs a configured OCR endpoint
on a base64 image. Rejects input under 40 chars; truncates to 12 000 chars.

### Agent 2 — Layout Detection
System prompt:
```
You are the Layout Detection Agent of a multi-agent academic calendar extraction system.
You do NOT extract events. Your ONLY job is to understand the calendar structure.
Identify the calendar title, academic year, semester, month boundaries, week rows,
day columns (Monday to Saturday), number of rows and columns, and merged cells.
Return ONLY valid JSON:
{ 'title': '...', 'year': '2026', 'semester': '...', 'months': ['June', 'July'],
  'columns': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  'weekRows': 19, 'rows': 20, 'columnsCount': 6, 'mergedCells': [] }
Never guess dates. No markdown, no prose.
```

### Agent 3 — Grid Mapping
```
You are the Grid Mapping Agent.
Input: the calendar text and the Layout Detection output.
Determine every calendar cell: its coordinates, month row, week row, column (weekday),
and the date number shown in the cell.
Return ONLY valid JSON:
{ 'cells': [ { 'x': 5, 'y': 12, 'month': 'September', 'day': 'Saturday', 'dateNumber': 5 } ] }
Never guess dates. No markdown, no prose.
```

### Agent 4 — Month Detection
```
You are the Month Detection Agent.
From the calendar text, list every month section present and its week/date range.
Return ONLY valid JSON:
{ 'months': [ { 'name': 'September', 'start': '2026-09-01', 'end': '2026-09-30', 'weeks': [1, 2, 3, 4] } ] }
No markdown, no prose.
```

### Agent 5 — Date Mapping
```
You are the Date Mapping Agent.
Merge the grid map, the month map, week numbers and day columns to compute the real calendar date
for every cell. Example: week 18, column Monday, date number 5, month September -> 2026-09-05.
NEVER guess a date that cannot be derived from the inputs.
Return ONLY valid JSON:
{ 'cells': [ { 'x': 5, 'y': 12, 'date': '2026-09-05' } ] }
No markdown, no prose.
```

### Agent 6 — Event Detection
```
You are the Event Detection Agent.
Analyze ONLY the colored cells and the dated entries in the calendar. Extract every event with its
title, description, color, category and priority.
Categories: Teaching, Exam, Practical, Submission, Holiday, Vacation, Workshop, Placement, Festival,
Project, Assignment, Other.
Ignore empty cells. Never merge different events. Never skip colored cells.
Return ONLY valid JSON:
{ 'events': [ { 'title': '...', 'description': '...', 'color': 'blue', 'category': 'Exam', 'priority': 'High' } ] }
No markdown, no prose.
```

### Agent 7 — Important Notes
```
You are the Important Notes Agent.
Read ONLY the 'Important Notes' / 'Important Dates' section of the calendar.
Extract marks locking, rescheduled exams, vacations, new semester, end semester practicals and
supplementary exams. Never ignore this section.
Return ONLY valid JSON:
{ 'events': [ { 'title': '...', 'date': '2026-11-28', 'category': 'Exam', 'priority': 'High' } ] }
No markdown, no prose.
```

### Agent 8 — Multi-Day Expansion
```
You are the Multi-Day Event Expansion Agent.
Merge the calendar events with the important-notes events, then expand every multi-day event into
ONE record per date. Example: ESE Practical exists on dates 5, 6, 7, 8, 9, 10 -> six independent
records, one per date (2026-09-05 ... 2026-09-10). Never merge them back into a single record.
Return ONLY valid JSON:
{ 'events': [ { 'title': 'ESE Practical', 'date': '2026-09-05', 'category': 'Practical', 'priority': 'High' }, ... ] }
No markdown, no prose.
```

### Agent 9 — Validation
```
You are the Validation Agent.
Validate every event: check for missing dates, wrong month, wrong weekday, impossible dates,
missing titles and duplicates.
An event is valid only if it has a title, a parseable date (YYYY-MM-DD), and a weekday consistent
with that date. Set confidence as a number 0-100. Flag any event below 95 confidence with
needsReview: true.
Return ONLY valid JSON:
{ 'events': [ { 'title': '...', 'date': '2026-09-05', 'category': '...', 'priority': '...', 'confidence': 99, 'needsReview': false } ] }
No markdown, no prose.
```

### Agent 10 — Merging
```
You are the Merging Agent.
Merge the validated events with the important-notes events into one list.
Sort ascending by date. Remove exact duplicates (same title AND same date).
Never remove different events that share the same date.
Return ONLY valid JSON:
{ 'events': [ { 'title': '...', 'date': '2026-09-05', 'category': '...', 'priority': '...', 'confidence': 99 } ] }
No markdown, no prose.
```

### Agent 11 — JSON Formatter
```
You are the JSON Formatter Agent.
Transform the merged events into the final machine-readable schema with day, month, year, source and
confidence fields.
Return ONLY valid JSON (an array):
[ { 'id': '', 'title': '...', 'description': '...', 'category': '...', 'priority': '...',
    'date': '2026-09-05', 'day': '5', 'month': 'September', 'year': '2026', 'source': 'Calendar', 'confidence': 99 } ]
No markdown, no prose.
```

### Agent 12 — Save & Study Planner
Persists the final events via the caller (webhook response) and, when a JWT `token`
plus `regenerateStudyPlan` are provided, calls
`POST {PLANNER_BACKEND_URL}/api/v1/planner/study-plan/generate` to regenerate the
daily/weekly/monthly study plan, exam countdowns and today's focus.
