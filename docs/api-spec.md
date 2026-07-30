# api-spec.md

> **Project:** CareerOS
>
> **Version:** v1.0
>
> **Document Type:** REST API Specification
>
> **API Style:** RESTful
>
> **Authentication:** JWT
>
> **Response Format:** JSON
>
> **Status:** Draft

---

# 1. Overview

This document defines the REST API contract for CareerOS.

The API follows REST principles and is designed to remain stable throughout Version 1.

Every client application (React, Mobile, Future Desktop App) must communicate only through these APIs.

Direct database access is strictly prohibited.

---

# 2. API Principles

The CareerOS API follows these principles.

- RESTful
- Stateless
- Versioned
- Secure
- Consistent
- Predictable
- Backward Compatible

---

# 3. Base URL

Development

```
http://localhost:8080/api/v1
```

Production

```
https://api.careeros.com/api/v1
```

Future versions

```
/api/v2
```

Never modify existing API behavior.

Create a new version instead.

---

# 4. Content Type

Every request

```
Content-Type: application/json
```

File Upload

```
multipart/form-data
```

---

# 5. Authentication

CareerOS uses JWT Authentication.

Flow

```
Register

↓

Login

↓

JWT Generated

↓

Frontend Stores Token

↓

Authorization Header

↓

Backend Validation

↓

Access Granted
```

---

## Authorization Header

Every protected endpoint requires

```
Authorization: Bearer <JWT_TOKEN>
```

---

# 6. Standard Response Format

Every endpoint returns the same structure.

## Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {},
  "timestamp": "2026-08-01T09:30:00Z"
}
```

---

## Error Response

```json
{
  "success": false,
  "message": "Validation failed.",
  "errorCode": "VALIDATION_ERROR",
  "errors": [],
  "timestamp": "2026-08-01T09:30:00Z"
}
```

---

# 7. HTTP Status Codes

| Status | Meaning |
|---------|----------|
| 200 | Success |
| 201 | Resource Created |
| 204 | No Content |
| 400 | Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Resource Not Found |
| 409 | Conflict |
| 422 | Invalid Business Rule |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

# 8. Authentication APIs

---

## Register User

### Endpoint

```
POST /auth/register
```

### Authentication

Not Required

---

### Request Body

```json
{
  "fullName": "Kalpataru Dash",
  "email": "kalpataru@example.com",
  "password": "Password@123"
}
```

---

### Success Response

```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "userId": "uuid"
  }
}
```

---

### Validation Rules

- Name required
- Email required
- Email unique
- Password minimum length
- Strong password required

---

## Login

### Endpoint

```
POST /auth/login
```

Authentication

Not Required

---

### Request

```json
{
  "email": "kalpataru@example.com",
  "password": "Password@123"
}
```

---

### Response

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "accessToken": "JWT_TOKEN",
    "expiresIn": 3600
  }
}
```

---

## Logout

### Endpoint

```
POST /auth/logout
```

Authentication

Required

---

### Response

```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

## Get Current User

### Endpoint

```
GET /auth/me
```

Authentication

Required

---

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "Kalpataru Dash",
    "email": "kalpataru@example.com"
  }
}
```

---

## Refresh Token (Future)

```
POST /auth/refresh
```

Not implemented in Version 1.

---

# 9. User APIs

These APIs manage the user's profile and preferences.

---

## Create Profile

### Endpoint

```
POST /users/profile
```

Authentication

Required

---

### Request

```json
{
  "college": "Parul University",
  "university": "Parul University",
  "branch": "Computer Science",
  "semester": 5,
  "cgpa": 8.9,
  "studyHours": 4
}
```

---

### Response

```json
{
  "success": true,
  "message": "Profile created successfully."
}
```

---

## Get Profile

### Endpoint

```
GET /users/profile
```

Authentication

Required

---

### Response

```json
{
  "success": true,
  "data": {
    "fullName": "Kalpataru Dash",
    "college": "Parul University",
    "semester": 5,
    "cgpa": 8.9,
    "studyHours": 4
  }
}
```

---

## Update Profile

### Endpoint

```
PUT /users/profile
```

Authentication

Required

---

### Request

```json
{
  "semester": 6,
  "cgpa": 9.0,
  "studyHours": 5
}
```

---

### Response

```json
{
  "success": true,
  "message": "Profile updated successfully."
}
```

---

## Update Preferences

### Endpoint

```
PATCH /users/preferences
```

Authentication

Required

---

### Request

```json
{
  "preferredCompanies": [
    "Amazon",
    "Microsoft",
    "Google"
  ],
  "preferredTechStack": [
    "Java",
    "Spring Boot",
    "React"
  ]
}
```

---

### Response

```json
{
  "success": true,
  "message": "Preferences updated successfully."
}
```

---

## Delete Account (Future)

```
DELETE /users
```

Version 2

---

# 10. Validation Rules

## Email

- Required
- Valid format
- Unique

---

## Password

Minimum

- 8 Characters

Must contain

- Uppercase
- Lowercase
- Number
- Special Character

---

## Semester

Allowed

```
1–8
```

---

## CGPA

Allowed

```
0.00–10.00
```

---

## Study Hours

Allowed

```
1–16 Hours
```

---

# 11. API Security Rules

Every endpoint must

- Validate JWT
- Validate Input
- Validate Ownership

Example

A user cannot update another user's profile.

Ownership validation is mandatory.

---

# 12. API Naming Standards

Use nouns.

Correct

```
/users/profile
```

Wrong

```
/getProfile
```

Correct

```
/academic/calendar
```

Wrong

```
/fetchCalendar
```

---

# 13. Pagination Standard

Future endpoints returning collections should use

```
?page=0

&size=20

&sort=createdAt,desc
```

Example

```
GET /notifications?page=0&size=10
```

---

# 14. Idempotency Rules

GET

Safe

POST

Creates resources

PUT

Replaces resource

PATCH

Partial update

DELETE

Deletes resource

---

# End of Part 1

## Next Part

The next section of **`api-spec.md`** will include:

- Academic APIs
- Academic PDF Upload API
- Calendar APIs
- Placement APIs
- Mock Interview APIs
- Dashboard APIs
- Recommendation APIs
---

# 15. Academic APIs

The Academic Module is responsible for

- Academic Booklet Upload
- PDF Processing
- Academic Calendar
- Subjects
- Semester Information

It is **not responsible** for study planning.

---

# 16. Upload Academic Booklet

## Endpoint

```
POST /academic/booklets
```

Authentication

Required

Content-Type

```
multipart/form-data
```

---

## Request

| Field | Type | Required |
|--------|------|----------|
| file | PDF | Yes |

---

### Validation Rules

- PDF only
- Maximum Size: 25 MB
- Password Protected PDFs not allowed
- Duplicate upload allowed (Versioning)

---

## Success Response

```json
{
  "success": true,
  "message": "Academic booklet uploaded successfully.",
  "data": {
    "bookletId": "uuid",
    "status": "PROCESSING"
  }
}
```

---

## Processing Flow

```text
Upload

↓

Virus Validation (Future)

↓

Store File

↓

Queue Processing

↓

OCR Detection

↓

Extraction

↓

Validation

↓

Database

↓

Calendar Generation
```

---

# 17. Get Booklet Processing Status

## Endpoint

```
GET /academic/booklets/{bookletId}/status
```

Authentication

Required

---

## Success Response

```json
{
    "success": true,
    "data": {
        "status": "COMPLETED",
        "progress": 100,
        "confidence": 98
    }
}
```

Possible Status

- UPLOADED
- PROCESSING
- VALIDATING
- COMPLETED
- FAILED

---

# 18. List Academic Booklets

## Endpoint

```
GET /academic/booklets
```

Authentication

Required

---

## Response

```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "version": 2,
            "uploadedAt": "2026-08-01",
            "status": "COMPLETED",
            "active": true
        }
    ]
}
```

---

# 19. Set Active Booklet

## Endpoint

```
PATCH /academic/booklets/{bookletId}/activate
```

Authentication

Required

---

## Rules

- Only one booklet can remain active.
- Previous active booklet becomes inactive.
- No data loss.

---

## Response

```json
{
    "success": true,
    "message": "Academic booklet activated."
}
```

---

# 20. Semester API

## Get Semester

```
GET /academic/semester
```

Authentication

Required

---

### Response

```json
{
    "success": true,
    "data": {
        "semesterName": "Semester 5",
        "academicYear": "2026",
        "startDate": "2026-07-15",
        "endDate": "2026-12-10"
    }
}
```

---

# 21. Subjects API

## Get Subjects

```
GET /academic/subjects
```

Authentication

Required

---

### Response

```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "subjectName": "Operating Systems",
            "subjectCode": "CS501",
            "credits": 4
        }
    ]
}
```

---

# 22. Academic Calendar API

## Get Calendar

```
GET /academic/calendar
```

Authentication

Required

---

### Response

```json
{
    "success": true,
    "data": [
        {
            "title": "Mid Semester",
            "type": "MIDSEM",
            "date": "2026-09-15"
        },
        {
            "title": "Holiday",
            "type": "HOLIDAY",
            "date": "2026-08-15"
        }
    ]
}
```

---

# 23. Academic Events API

## Get Events

```
GET /academic/events
```

Authentication

Required

---

### Query Parameters

```
from

to

type
```

Example

```
GET /academic/events?type=MIDSEM
```

---

# 24. Refresh Academic Extraction

## Endpoint

```
POST /academic/booklets/{bookletId}/reprocess
```

Authentication

Required

---

## Use Cases

- OCR failed
- Better AI model available
- User requests reprocessing

---

# 25. Placement APIs

The Placement Module provides

- Mock Interviews
- Mock History
- Scores

Nothing else.

---

# 26. Start Mock Interview

## Endpoint

```
POST /placement/mock/start
```

Authentication

Required

---

### Request

```json
{
    "mockType": "DSA",
    "topic": "Arrays"
}
```

---

Allowed mockType

- DSA
- TECHNICAL
- HR
- APTITUDE

---

### Response

```json
{
    "success": true,
    "data": {
        "mockSessionId": "uuid",
        "questions": []
    }
}
```

---

# 27. Submit Mock

## Endpoint

```
POST /placement/mock/{sessionId}/submit
```

Authentication

Required

---

### Request

```json
{
    "answers": []
}
```

---

### Response

```json
{
    "success": true,
    "data": {
        "score": 84,
        "duration": 1450,
        "feedback": "Good understanding of Arrays."
    }
}
```

---

# 28. Mock History

## Endpoint

```
GET /placement/mock/history
```

Authentication

Required

---

### Query Parameters

```
page

size

type
```

---

### Response

```json
{
    "success": true,
    "data": [
        {
            "sessionId": "uuid",
            "type": "TECHNICAL",
            "score": 91,
            "completedAt": "2026-08-01"
        }
    ]
}
```

---

# 29. Dashboard APIs

## Get Dashboard

```
GET /dashboard
```

Authentication

Required

---

### Response

```json
{
    "success": true,
    "data": {
        "priority": "PLACEMENT",
        "reason": "No exams within 25 days.",
        "recommendedStudyHours": 4,
        "upcomingEvents": [],
        "progress": {}
    }
}
```

---

# 30. Priority API

## Endpoint

```
GET /dashboard/priority
```

Authentication

Required

---

### Response

```json
{
    "success": true,
    "data": {
        "priority": "ACADEMICS",
        "reason": "Mid Semester begins in 10 days.",
        "confidence": 97
    }
}
```

---

# 31. Override Recommendation

## Endpoint

```
POST /dashboard/priority/override
```

Authentication

Required

---

### Request

```json
{
    "priority": "PLACEMENT"
}
```

Allowed Values

- ACADEMICS
- PLACEMENT

---

### Response

```json
{
    "success": true,
    "message": "Recommendation overridden successfully."
}
```

---

# 32. Study Hour Recommendation

## Endpoint

```
GET /dashboard/study-hours
```

Authentication

Required

---

### Response

```json
{
    "success": true,
    "data": {
        "recommendedHours": 4
    }
}
```

---

# API Design Rules

- APIs never expose database entities.
- APIs always return DTOs.
- Every endpoint validates ownership.
- Every response follows the global response format.
- All endpoints are versioned.
- Breaking changes require `/api/v2`.
- Long-running tasks (PDF extraction, AI processing) are asynchronous and return a processing status instead of blocking the request.

---

# End of Part 2

## Next Part

Part 3 will include:

- Notification APIs
- AI APIs
- Recommendation APIs
- Common DTO Schemas
- Validation Error Schemas
- Standard Error Codes
- OpenAPI Examples
---

# 33. Notification APIs

The Notification Module is responsible for delivering meaningful system events.

Notifications are event-driven.

Notifications are **never** generated by polling.

---

# 34. Get Notifications

## Endpoint

```
GET /notifications
```

Authentication

Required

---

### Query Parameters

```
page

size

status

type
```

Example

```
GET /notifications?page=0&size=20&status=UNREAD
```

---

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Today's Priority",
      "message": "Placement should be your priority today.",
      "type": "PRIORITY",
      "status": "UNREAD",
      "createdAt": "2026-08-01T09:00:00Z"
    }
  ]
}
```

---

# 35. Get Notification

## Endpoint

```
GET /notifications/{notificationId}
```

Authentication

Required

---

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Exam Reminder",
    "message": "Mid Semester starts in 10 days.",
    "status": "UNREAD"
  }
}
```

---

# 36. Mark Notification as Read

## Endpoint

```
PATCH /notifications/{notificationId}/read
```

Authentication

Required

---

### Response

```json
{
  "success": true,
  "message": "Notification marked as read."
}
```

---

# 37. Mark All Notifications as Read

## Endpoint

```
PATCH /notifications/read-all
```

Authentication

Required

---

### Response

```json
{
  "success": true,
  "message": "All notifications marked as read."
}
```

---

# 38. Delete Notification

## Endpoint

```
DELETE /notifications/{notificationId}
```

Authentication

Required

---

### Response

```json
{
  "success": true,
  "message": "Notification deleted successfully."
}
```

---

# 39. AI APIs

AI APIs are internal backend APIs.

Frontend should never call AI providers directly.

Flow

```
Frontend

↓

Spring Boot

↓

AI Service

↓

OpenAI / Claude

↓

Spring Boot

↓

Frontend
```

---

# 40. Generate Mock Questions

## Endpoint

```
POST /ai/mock/generate
```

Authentication

Required

---

### Request

```json
{
  "mockType": "TECHNICAL",
  "technology": "Spring Boot",
  "difficulty": "MEDIUM",
  "questionCount": 10
}
```

---

### Response

```json
{
  "success": true,
  "data": {
    "mockId": "uuid",
    "questions": []
  }
}
```

---

# 41. Evaluate Mock Answers

## Endpoint

```
POST /ai/mock/evaluate
```

Authentication

Required

---

### Request

```json
{
  "mockId": "uuid",
  "answers": []
}
```

---

### Response

```json
{
  "success": true,
  "data": {
    "score": 87,
    "feedback": [],
    "strengths": [],
    "improvements": []
  }
}
```

---

# 42. Generate Recommendation Explanation

## Endpoint

```
POST /ai/recommendation/explain
```

Authentication

Required

---

### Request

```json
{
  "priority": "ACADEMICS",
  "reasonCode": "EXAM_NEAR"
}
```

---

### Response

```json
{
  "success": true,
  "data": {
    "explanation": "Your Mid Semester examination begins in 8 days, therefore academic preparation has higher priority."
  }
}
```

---

# 43. AI Rules

AI APIs

CAN

- Generate explanations
- Generate interview questions
- Evaluate answers

AI APIs

CANNOT

- Change priorities
- Update calendar
- Modify database directly
- Authenticate users

---

# 44. Common DTO Schemas

---

## UserDTO

```json
{
  "id": "uuid",
  "fullName": "Kalpataru Dash",
  "email": "user@example.com"
}
```

---

## SubjectDTO

```json
{
  "id": "uuid",
  "subjectName": "Operating Systems",
  "subjectCode": "CS501",
  "credits": 4
}
```

---

## AcademicEventDTO

```json
{
  "id": "uuid",
  "title": "Mid Semester",
  "type": "MIDSEM",
  "date": "2026-09-15"
}
```

---

## RecommendationDTO

```json
{
  "priority": "PLACEMENT",
  "reason": "No examinations are scheduled within the next 25 days.",
  "recommendedStudyHours": 4,
  "confidence": 96
}
```

---

## NotificationDTO

```json
{
  "id": "uuid",
  "title": "Exam Reminder",
  "message": "Mid Semester starts in 10 days.",
  "status": "UNREAD"
}
```

---

## MockResultDTO

```json
{
  "sessionId": "uuid",
  "score": 90,
  "duration": 1600,
  "feedback": []
}
```

---

# 45. Validation Error Schema

Every validation error follows one structure.

```json
{
  "success": false,
  "message": "Validation failed.",
  "errorCode": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Email is required."
    }
  ],
  "timestamp": "2026-08-01T10:00:00Z"
}
```

---

# 46. Standard Error Codes

| Error Code | Description |
|------------|-------------|
| VALIDATION_ERROR | Request validation failed |
| INVALID_TOKEN | JWT token invalid |
| TOKEN_EXPIRED | JWT expired |
| ACCESS_DENIED | User unauthorized |
| RESOURCE_NOT_FOUND | Resource missing |
| DUPLICATE_RESOURCE | Duplicate record |
| FILE_TOO_LARGE | Upload exceeds limit |
| INVALID_FILE_TYPE | Unsupported file |
| PDF_PROCESSING_FAILED | PDF extraction failed |
| AI_SERVICE_UNAVAILABLE | AI provider unavailable |
| DATABASE_ERROR | Database operation failed |
| INTERNAL_SERVER_ERROR | Unexpected server error |

---

# 47. Rate Limiting

To prevent abuse, APIs are rate limited.

| Endpoint | Limit |
|----------|------:|
| Login | 5 requests/minute |
| Register | 3 requests/minute |
| AI APIs | 30 requests/hour |
| PDF Upload | 10 uploads/day |
| Mock Generation | 100/day |

---

# 48. API Versioning Strategy

Current Version

```
/api/v1
```

Future

```
/api/v2
```

Rules

- Existing endpoints are never modified.
- Breaking changes require a new API version.
- Deprecated endpoints remain available until officially removed.

---

# 49. OpenAPI Naming Conventions

Controllers

```
AcademicController
```

Tags

```
Authentication

Users

Academic

Placement

Dashboard

Notifications

AI
```

Operation IDs

```
uploadAcademicBooklet

getDashboard

startMockInterview

getNotifications
```

---

# 50. API Governance Rules

Every API must satisfy:

- JWT Authentication (if protected)
- Request Validation
- Ownership Validation
- DTO Responses
- Standard Response Format
- Proper HTTP Status Codes
- Structured Error Responses
- Logging
- Performance Monitoring

No endpoint may bypass these rules.

---

# End of Part 3

## Next Part (Final)

The final section of **`api-spec.md`** will include:

- OpenAPI Examples
- Idempotency Rules
- API Lifecycle
- Deprecation Policy
- Security Headers
- Webhook/Event Contracts (Future)
- API Testing Strategy
- API Acceptance Checklist
- Final API Governance
- End of `api-spec.md`
---

# 51. OpenAPI Examples

The following examples define the expected API behavior.

These examples should be used while implementing the OpenAPI (Swagger) specification.

---

## Example

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

Request

```json
{
    "email":"user@example.com",
    "password":"Password@123"
}
```

Response

```json
{
    "success":true,
    "message":"Login successful.",
    "data":{
        "accessToken":"JWT_TOKEN",
        "expiresIn":3600
    }
}
```

---

## Example

### Upload Academic Booklet

```http
POST /api/v1/academic/booklets
Content-Type: multipart/form-data
Authorization: Bearer JWT_TOKEN
```

Response

```json
{
    "success":true,
    "message":"Academic booklet uploaded successfully.",
    "data":{
        "bookletId":"uuid",
        "status":"PROCESSING"
    }
}
```

---

## Example

### Dashboard

```http
GET /api/v1/dashboard
Authorization: Bearer JWT_TOKEN
```

Response

```json
{
    "success":true,
    "data":{
        "priority":"PLACEMENT",
        "reason":"No examinations are scheduled within the next 28 days.",
        "recommendedStudyHours":4,
        "upcomingEvents":[],
        "progress":{}
    }
}
```

---

# 52. Idempotency Rules

REST endpoints should behave predictably.

| Method | Idempotent | Description |
|----------|------------|-------------|
| GET | Yes | Read only |
| POST | No | Creates new resource |
| PUT | Yes | Replaces resource |
| PATCH | No | Partial update |
| DELETE | Yes | Deletes resource |

---

## Duplicate Submission Protection

Critical endpoints must prevent duplicate requests.

Examples

- Login
- Register
- PDF Upload
- Mock Submission

Possible solutions

- Request ID
- Idempotency Key
- Transaction Lock

---

# 53. API Lifecycle

Every API follows the same lifecycle.

```text
Client Request

↓

Authentication

↓

Authorization

↓

Validation

↓

Business Logic

↓

Database

↓

DTO Mapping

↓

Response

↓

Logging
```

No endpoint should bypass this lifecycle.

---

# 54. API Deprecation Policy

APIs are never removed immediately.

Lifecycle

```text
Stable

↓

Deprecated

↓

Announcement

↓

Migration Window

↓

Removal
```

Deprecation notice should include

- Replacement Endpoint
- Removal Date
- Migration Guide

---

# 55. Security Headers

Every response should include

```http
Strict-Transport-Security

Content-Security-Policy

X-Frame-Options

X-Content-Type-Options

Referrer-Policy

Permissions-Policy
```

---

# 56. CORS Policy

Allowed Origins

Development

```
http://localhost:5173
```

Production

```
https://careeros.com
```

Reject all unknown origins.

---

# 57. Request Size Limits

Authentication APIs

```
1 MB
```

Profile APIs

```
1 MB
```

PDF Upload

```
25 MB
```

Future

Configurable.

---

# 58. Timeout Policy

Authentication

10 seconds

AI APIs

60 seconds

Database Queries

5 seconds

PDF Processing

Asynchronous

Never keep users waiting for long-running jobs.

---

# 59. Retry Strategy

Retry allowed only for

- AI Provider Timeout
- Temporary Network Failure
- Notification Delivery

Never retry

- Authentication
- Payment (Future)
- Database Writes without transaction protection

---

# 60. API Testing Strategy

Every endpoint requires

## Unit Tests

Controller

Service

Validation

---

## Integration Tests

Controller

↓

Service

↓

Repository

↓

Database

---

## End-to-End Tests

Frontend

↓

Backend

↓

Database

↓

Response

---

## Negative Tests

Missing Fields

Invalid JWT

Invalid File

Invalid Semester

Invalid User

Expired Token

---

## Load Tests

Dashboard

Login

Calendar

Mock Generation

PDF Upload Queue

---

# 61. API Documentation

Swagger/OpenAPI must be enabled.

Production

Read Only

Development

Interactive

Every endpoint requires

- Summary
- Description
- Parameters
- Example Request
- Example Response
- Error Codes

---

# 62. Webhooks (Future)

Version 1

Not Supported

Future Examples

```
ACADEMIC_IMPORT_COMPLETED

PRIORITY_CHANGED

MOCK_COMPLETED

WEEKLY_REPORT_READY
```

Each webhook must

- Be signed
- Be authenticated
- Support retries

---

# 63. API Observability

Every request should include

Correlation ID

Example

```http
X-Correlation-ID:
```

Logs should include

- Correlation ID
- User ID
- Request Time
- Response Time
- Status Code

This allows request tracing across services.

---

# 64. API Performance Targets

| API | Target |
|------|--------|
| Login | < 500 ms |
| Dashboard | < 2 sec |
| Calendar | < 2 sec |
| Profile | < 1 sec |
| Notifications | < 1 sec |
| PDF Upload | < 2 sec (Acknowledgement Only) |
| Mock Generation | < 5 sec |

---

# 65. API Acceptance Checklist

Every API is considered complete only if

- [ ] Authentication implemented
- [ ] Authorization implemented
- [ ] Validation implemented
- [ ] DTOs implemented
- [ ] Standard Response Format followed
- [ ] Swagger documented
- [ ] Unit Tests written
- [ ] Integration Tests written
- [ ] Error Handling implemented
- [ ] Logging implemented
- [ ] Monitoring enabled
- [ ] Backward Compatibility verified

---

# 66. API Governance

Every contributor must follow these rules.

Never

- Return Entity Objects
- Skip Validation
- Hardcode Responses
- Break Existing Contracts
- Change Response Structure
- Expose Internal IDs
- Expose Stack Traces

Always

- Use DTOs
- Use Standard Responses
- Validate Ownership
- Log Requests
- Version APIs
- Document Endpoints

---

# 67. API Design Principles (Immutable)

1. APIs must remain backward compatible.
2. Every endpoint is authenticated unless explicitly public.
3. Every response follows the global response schema.
4. Validation happens before business logic.
5. Controllers remain thin.
6. Services own business logic.
7. DTOs isolate internal models.
8. AI is accessed only through the AI Service.
9. Long-running work is asynchronous.
10. API contracts are considered public interfaces.

---

# 68. Definition of Done

An API endpoint is complete only if:

- Functional implementation completed
- Business logic validated
- Security verified
- Ownership checks implemented
- Documentation updated
- Tests passed
- Logging added
- Performance acceptable
- Error responses standardized
- Reviewed against `architecture.md` and `agent.md`

---

# END OF DOCUMENT

Document Name

```
api-spec.md
```

Status

```
APPROVED
```

Priority

```
Must be followed by every backend implementation.
```
Complete ER diagrams (Mermaid)
Table definitions
Column types
Primary/Foreign keys
Index strategy
Constraints
Migration strategy (Flyway/Liquibase)
Audit fields
Soft delete strategy
Query optimization
Repository design
Sample seed data
Backup & recovery plan
