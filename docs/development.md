# development.md

> **Project:** CareerOS
>
> **Version:** 1.0
>
> **Document Type:** Development Standards
>
> **Status:** Mandatory
>
> **Audience:** Developers, Claude, ChatGPT, Cursor, GitHub Copilot, Antigravity
>
> **Priority:** Second only to `agent.md`

---

# PURPOSE

This document defines the engineering standards that every developer and AI assistant must follow while writing code.

The objective is to keep the codebase:

- Consistent
- Maintainable
- Production Ready
- Easy to Scale
- Easy to Review

Every Pull Request must satisfy this document before merge.

---

# 1. PROJECT STRUCTURE

The project follows a modular architecture.

```
CareerOS

frontend/

backend/

docs/

docker/

scripts/

.github/
```

Never mix frontend and backend code.

---

# 2. BACKEND STRUCTURE

```
backend

config/

controller/

service/

repository/

entity/

dto/

mapper/

security/

validation/

exception/

scheduler/

util/
```

Never create random packages.

---

# 3. FRONTEND STRUCTURE

```
src/

pages/

components/

layouts/

hooks/

services/

contexts/

types/

constants/

utils/

assets/
```

Keep components reusable.

---

# 4. FILE NAMING

React Components

```
DashboardPage.tsx

LoginPage.tsx

PriorityCard.tsx
```

Spring Boot

```
UserController

UserService

UserRepository

UserMapper

UserDTO
```

Never use inconsistent naming.

---

# 5. PACKAGE RULES

One package = One responsibility.

Wrong

```
utils/

contains

Authentication

Validation

Parsing

PDF

Everything
```

Correct

```
validation/

security/

pdf/

notification/
```

---

# 6. CLASS SIZE

Target

```
< 300 Lines
```

Maximum

```
500 Lines
```

If exceeded,

split into smaller classes.

---

# 7. METHOD SIZE

Ideal

```
10–30 Lines
```

Maximum

```
50 Lines
```

Long methods should be refactored.

---

# 8. CONTROLLER RULES

Controllers should only

- Accept Requests
- Validate DTOs
- Call Services
- Return Responses

Controllers must never

- Access Repository
- Calculate Business Logic
- Call AI Providers
- Perform Database Operations

---

# 9. SERVICE RULES

Services own business logic.

Allowed

- Validation
- Decision Making
- Transactions
- Orchestration

Forbidden

- HTTP Response Formatting
- UI Logic

---

# 10. REPOSITORY RULES

Repositories only

- Save
- Update
- Delete
- Query

Never

- Validate
- Calculate
- Call APIs

---

# 11. ENTITY RULES

Entities only represent database tables.

Never place

- Business Logic
- API Calls
- Validation
- Formatting

inside entities.

---

# 12. DTO RULES

Every request uses

Request DTO

Every response uses

Response DTO

Never expose entities directly.

---

# 13. MAPPER RULES

Use dedicated mappers.

```
Entity

↓

Mapper

↓

DTO
```

Never map inside controllers.

---

# 14. VALIDATION RULES

Validate

- Email
- Password
- UUID
- Dates
- File Size
- File Type
- Required Fields

Validation always happens before service execution.

---

# 15. EXCEPTION HANDLING

Use Global Exception Handler.

Never

```
try {
}
catch(Exception e){
}
```

inside every controller.

---

# 16. LOGGING

Log

- Login
- Upload
- AI Requests
- Notifications
- Recommendation Generation

Do not log

- Passwords
- Tokens
- Secrets

---

# 17. CONFIGURATION

Never hardcode

- URLs
- API Keys
- Passwords
- Database Credentials

Use

```
application.yml

Environment Variables
```

---

# 18. SECURITY

Always

JWT

BCrypt

HTTPS

CSRF (if applicable)

Input Validation

Never trust client input.

---

# 19. API RULES

REST only.

Versioned.

```
/api/v1
```

Never return entities.

Always return DTOs.

---

# 20. DATABASE RULES

Use Flyway.

Never modify previous migrations.

Always create new migration files.

Example

```
V1__Create_User.sql

V2__Create_Profile.sql

V3__Create_Semester.sql
```

---

# 21. AI INTEGRATION RULES

AI calls go through

```
AIService

↓

PromptBuilder

↓

Provider Adapter
```

Never call OpenAI/Claude directly from controllers.

---

# 22. N8N RULES

n8n only

- Schedule
- Trigger
- Notify

Never

- Calculate Priority
- Store Business Data

---

# 23. REACT RULES

Components must be

- Small
- Reusable
- Stateless when possible

Keep business logic inside hooks or services.

---

# 24. CUSTOM HOOK RULES

Create hooks for

- Authentication
- API Calls
- Notifications
- Dashboard Data

Avoid duplicate logic across pages.

---

# 25. STATE MANAGEMENT

Keep state local unless shared.

Global state should only include

- User
- Authentication
- Theme (Future)

Avoid unnecessary global state.

---

# 26. API SERVICE RULES

Every backend endpoint has one API service.

Example

```
AcademicService.ts

PlacementService.ts

NotificationService.ts
```

Never call Axios directly inside components.

---

# 27. UI RULES

Maintain a consistent design system.

Do not introduce new colors, spacing, or typography without updating the design tokens.

---

# 28. RESPONSIVE DESIGN

Support

- Desktop
- Tablet
- Mobile

Desktop-first is acceptable for Version 1, but layouts should not break on smaller screens.

---

# 29. TESTING RULES

Every feature requires

- Unit Tests
- Integration Tests
- Manual Verification

Critical flows require end-to-end tests.

---

# 30. GIT BRANCH STRATEGY

```
main

develop

feature/<feature-name>

bugfix/<issue>

hotfix/<issue>
```

Never commit directly to `main`.

---

# 31. COMMIT MESSAGE FORMAT

Use Conventional Commits.

Examples

```
feat: add academic booklet upload

fix: resolve JWT expiration issue

refactor: extract priority calculation service

docs: update API specification

test: add unit tests for recommendation engine
```

---

# 32. PULL REQUEST CHECKLIST

Before creating a PR

- [ ] Code builds successfully
- [ ] Tests pass
- [ ] No breaking API changes
- [ ] Documentation updated
- [ ] Logging added
- [ ] Validation implemented
- [ ] Existing features verified

---

# 33. PERFORMANCE CHECKLIST

Verify

- No unnecessary API calls
- No N+1 queries
- Proper indexes
- Lazy loading where appropriate
- Pagination on large datasets

---

# 34. CODE REVIEW CHECKLIST

Reviewer must verify

- Architecture compliance
- Clean code
- Naming consistency
- Error handling
- Security
- Test coverage
- Documentation updates

---

# 35. DEPENDENCY POLICY

Before adding a dependency

Ask

1. Is it necessary?
2. Is it actively maintained?
3. Does Spring/React already solve this?
4. Will it increase maintenance burden?

If the answer is unclear,

do not add it.

---

# 36. DOCUMENTATION POLICY

Every code change that affects architecture, APIs, database, or workflows must update the corresponding document.

Documentation is part of the feature.

A feature is not complete if the documentation is outdated.

---

# 37. DEFINITION OF DONE

A task is complete only when

- Feature implemented
- Code reviewed
- Tests passed
- Documentation updated
- Logging added
- Validation implemented
- No regression introduced
- Deployment ready

---

# 38. PRODUCTION CHECKLIST

Before every release

- Authentication verified
- Database migrations applied
- APIs tested
- AI fallback verified
- Notifications working
- Logs monitored
- Health checks passing
- Backups verified

---

# 39. ENGINEERING PRINCIPLES

Always prioritize

1. Correctness
2. Security
3. Maintainability
4. Readability
5. Performance
6. Scalability

Do not sacrifice the first four for premature optimization.

---

# 40. FINAL RULE

Every contributor must leave the codebase in a better state than they found it.

Small, incremental improvements are encouraged.

Large, architecture-changing rewrites are prohibited unless explicitly approved.

If there is any uncertainty, follow:

```
agent.md
↓

architecture.md
↓

development.md
↓

implementation-roadmap.md
```

---

# END OF DOCUMENT

Document Name

```
development.md
```

Status

```
MANDATORY
```