# agent.md

> **Project:** CareerOS
>
> **Version:** 2.0
>
> **Document Type:** Engineering Constitution
>
> **Priority:** HIGHEST
>
> **Status:** IMMUTABLE
>
> **Audience:** Claude, ChatGPT, Cursor, Antigravity, Copilot, Developers
>
> **Authority:** This document overrides every prompt unless the user explicitly approves an architectural change.

---

# PURPOSE

This document defines immutable engineering rules for CareerOS.

Every AI agent working on this repository MUST read and obey this document before making any change.

This document exists to prevent:

- Architecture Drift
- Breaking Changes
- Unnecessary Refactoring
- AI Hallucinated Code
- Duplicate Logic
- Poor Engineering Decisions
- Scope Creep

---

# HIGHEST PRIORITY RULE

> **DO NOT BREAK WORKING CODE.**

If a feature already works,

DO NOT

- rewrite it
- redesign it
- optimize it
- rename it
- move it

unless the user explicitly requests it.

---

# PROJECT AUTHORITY

Every AI must follow this priority.

```
agent.md

↓

architecture.md

↓

api-spec.md

↓

db-design.md

↓

implementation-roadmap.md

↓

project.md

↓

User Task
```

If a user task conflicts with architecture,

STOP.

Explain the conflict.

Do not silently change the architecture.

---

# AI IDENTITY

When working inside this project,

you are NOT

- Code Generator
- Junior Developer
- Tutorial Writer

You ARE

- Staff Software Engineer
- Software Architect
- CTO

Every decision must be made from that perspective.

---

# ARCHITECTURE LOCK

The following architecture is LOCKED.

```
React

↓

Spring Boot

↓

MySQL

↓

n8n

↓

AI Providers
```

No AI may

- replace Spring Boot
- replace React
- move business logic
- redesign architecture

without explicit approval.

---

# BUSINESS LOGIC

Business Logic belongs ONLY in

```
Spring Boot
```

Forbidden

Business Logic inside

- React
- AI
- n8n
- Database
- Controllers
- Repositories

---

# CONTROLLER RULES

Controllers may only

- Receive Requests
- Validate DTOs
- Call Services
- Return Responses

Controllers MUST NEVER

- Query Repository
- Calculate Priority
- Generate Business Logic
- Parse PDFs
- Call AI directly

---

# SERVICE RULES

Services own

- Business Logic
- Validation
- Orchestration
- Decision Making

Everything important belongs here.

---

# REPOSITORY RULES

Repositories perform ONLY

- CRUD
- Queries

Forbidden

- Validation
- Calculations
- AI Calls
- Business Rules

---

# DTO RULES

Entities NEVER leave backend.

Always

```
Entity

↓

Mapper

↓

DTO

↓

Frontend
```

Never expose entities.

---

# FRONTEND RULES

React exists ONLY for

- UI
- Forms
- Routing
- API Calls
- Rendering

Forbidden

- Priority Engine
- Study Recommendation Logic
- Business Rules
- Calendar Calculations
- Academic Decisions

---

# AI RULES

AI is an assistant.

AI is NEVER an authority.

AI MAY

- Extract PDFs
- Generate Questions
- Explain Decisions
- Evaluate Answers

AI MAY NOT

- Decide Priority
- Update Database
- Authenticate Users
- Replace Validation
- Modify Calendar
- Make Business Decisions

---

# n8n RULES

n8n exists ONLY for

Automation.

Allowed

- Schedule Jobs
- Send Notifications
- Sync Calendar
- Trigger APIs

Forbidden

- Business Logic
- Database Updates
- Priority Calculations
- AI Decision Making

---

# DATABASE RULES

Database is

THE SINGLE SOURCE OF TRUTH.

Never trust

- React State
- AI Output
- Cache
- Browser Storage

Every write

↓

Validation

↓

Transaction

↓

Database

---

# VALIDATION RULES

Every request MUST be validated.

Always validate

- Null
- Empty
- Length
- Dates
- UUID
- Ownership
- Authorization
- File Type
- File Size

Never trust frontend validation.

---

# API RULES

Public APIs are CONTRACTS.

Never

- Rename Endpoints
- Change Response Format
- Remove Fields
- Break Clients

Breaking changes require

```
/api/v2
```

---

# MODULE RULES

Every module has ONE responsibility.

Academic Module

↓

Academics Only

Placement Module

↓

Placement Only

Priority Module

↓

Priority Only

Notification Module

↓

Notifications Only

No cross responsibilities.

---

# DEPENDENCY RULES

Allowed

```
Controller

↓

Service

↓

Repository

↓

Database
```

Forbidden

```
Controller

↓

Repository
```

Forbidden

```
React

↓

Database
```

Forbidden

```
AI

↓

Database
```

---

# FEATURE DEVELOPMENT RULES

Every new feature must

- be modular
- be isolated
- be independently testable
- be backward compatible

Never modify working features.

Extend them.

---

# EXTENSION PRINCIPLE

Wrong

```
Rewrite Existing Module
```

Correct

```
Create New Module

↓

Integrate

↓

Test
```

---

# REFACTOR POLICY

Never refactor because

"it looks cleaner."

Allowed only when

- Bug
- Performance Issue
- Security Issue
- Explicit User Request

---

# FILE RULES

Never

Delete Files

Rename Files

Move Files

Merge Files

Without approval.

Always

Create

Extend

Document

---

# DATABASE MIGRATIONS

Never modify old migrations.

Always create

```
V1

V2

V3

...
```

Never

Drop Production Tables

Rename Columns

Delete User Data

---

# LOGGING RULES

Every important action must log

Timestamp

User

Module

Execution Time

Status

Request ID

Examples

- Login
- Upload
- Recommendation
- AI Call
- Notification

---

# ERROR HANDLING

Never

```
Something went wrong
```

Always

```
Meaningful Message

Error Code

Timestamp

Resolution Hint
```

---

# SECURITY RULES

Never

Commit Secrets

Commit API Keys

Commit Passwords

Expose Stack Traces

Store Plain Passwords

Expose Internal IDs

Always

Use

JWT

BCrypt

HTTPS

Environment Variables

---

# PERFORMANCE RULES

Never

Nested Database Loops

Repeated Queries

Blocking AI Calls

Large Synchronous Jobs

Always

Paginate

Index

Cache Appropriate Data

Optimize Queries

---

# PDF PROCESSING RULES

Pipeline MUST remain

```
Upload

↓

OCR Detection

↓

Parser

↓

AI Extraction

↓

Validation

↓

Database
```

Never bypass validation.

---

# PRIORITY ENGINE RULES

Priority Engine is

CORE IP

Nobody except

Priority Service

may calculate priority.

Forbidden

Frontend

AI

n8n

Controllers

Repositories

---

# TESTING RULES

Every feature requires

Unit Test

Integration Test

Manual Test

Regression Test

No exceptions.

---

# REGRESSION RULES

Before merging

Verify

Authentication

Dashboard

Academic

Placement

Priority Engine

Notifications

API Compatibility

No regression allowed.

---

# DOCUMENTATION RULES

Every implementation updates

- project.md
- architecture.md (if needed)
- api-spec.md (if APIs change)
- db-design.md (if schema changes)
- implementation-roadmap.md (if roadmap changes)

Documentation must never become outdated.

---

# DEPENDENCY POLICY

Before adding any library ask

1. Can Java/Spring already solve this?
2. Can React already solve this?
3. Is the dependency actively maintained?
4. Is it production ready?

If unnecessary,

DO NOT ADD IT.

---

# CODE QUALITY

Mandatory

- SOLID
- DRY
- KISS
- Clean Code
- Constructor Injection
- Interface Driven Design
- Composition over Inheritance

---

# COMMIT PHILOSOPHY

Every change should be

Small

Atomic

Reversible

Documented

Never create massive changesets.

---

# IMPLEMENTATION CHECKLIST

Before writing code

Always ask

- Does this already exist?
- Will this break something?
- Can this be extended?
- Does architecture allow it?
- Is there already a service?

If uncertain

STOP

Analyze

Then implement.

---

# AI RESPONSE FORMAT

Before generating code

Always perform

1. Architecture Impact Analysis
2. Dependency Analysis
3. Existing Code Analysis
4. Implementation Plan

Then write code.

Never immediately generate code.

---

# FORBIDDEN ACTIONS

Never

❌ Rewrite working modules

❌ Change architecture

❌ Rename packages

❌ Delete files

❌ Remove APIs

❌ Break DTOs

❌ Break Database Schema

❌ Hardcode Secrets

❌ Skip Validation

❌ Skip Tests

❌ Skip Logging

❌ Skip Documentation

❌ Mix Business Logic into React

❌ Mix Business Logic into n8n

❌ Let AI own decisions

❌ Ignore backward compatibility

---

# MANDATORY ACTIONS

Always

✅ Read existing code first

✅ Reuse existing services

✅ Follow architecture.md

✅ Follow API contracts

✅ Validate everything

✅ Log everything important

✅ Test every feature

✅ Keep modules independent

✅ Update documentation

✅ Protect backward compatibility

---

# FINAL CONSTITUTION

CareerOS is a production software product.

It is NOT

- a tutorial project
- a hackathon prototype
- a demo application

Every implementation must be production-ready.

Architecture stability is more important than development speed.

Quality is more important than feature count.

Never sacrifice long-term maintainability for short-term convenience.

---

# EXECUTION DIRECTIVE

Before every task, every AI must internally verify:

- I have read `agent.md`.
- I will not violate the architecture.
- I will not rewrite working code.
- I will preserve backward compatibility.
- I will implement only the requested scope.
- I will keep the system modular and production-ready.

If any of these conditions cannot be satisfied, implementation must stop and the conflict must be explained instead of guessing.

---

# END OF DOCUMENT