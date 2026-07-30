# implementation-roadmap.md

> **Project:** CareerOS
>
> **Version:** 1.0
>
> **Document Type:** Implementation Roadmap
>
> **Execution Strategy:** Dependency-Driven Development
>
> **Status:** Approved
>
> **Target Audience:** Claude, Antigravity, ChatGPT, Developers

---

# 1. Purpose

This document defines the implementation sequence of CareerOS.

It is **NOT** a timeline.

It is an execution blueprint.

Every task must be completed in dependency order.

Never skip dependencies.

Never build future modules before current modules are stable.

---

# 2. Development Philosophy

CareerOS should be developed using

## Vertical Slice Development

Every phase should produce a working application.

Never build

Frontend only.

Backend only.

Database only.

Instead

Complete one feature end-to-end.

---

# 3. Execution Rules

Every phase must satisfy

- Code Compiles
- APIs Tested
- Database Migrated
- UI Connected
- Documentation Updated
- Existing Features Working

Only then move to the next phase.

---

# 4. Dependency Graph

```text
Foundation

↓

Authentication

↓

User Profile

↓

Academic Module

↓

Placement Module

↓

Priority Engine

↓

Dashboard

↓

Notifications

↓

AI

↓

Production
```

Never violate this order.

---

# PHASE 0

# Project Bootstrap

## Objective

Create a production-ready project foundation.

---

## Backend

Create

```
Spring Boot Project

Java 21

Maven

MySQL

Spring Security

JWT

Spring Validation

Spring Data JPA
```

---

## Frontend

Create

```
React

TypeScript

TailwindCSS

React Router

Axios

React Query (Optional)
```

---

## Infrastructure

Create

```
Docker

Docker Compose

Git Repository

Git Ignore

Environment Files
```

---

## Folder Structure

Backend

```
config

controller

service

repository

entity

dto

mapper

security

validation

exception

util
```

Frontend

```
pages

components

layouts

hooks

services

contexts

types

utils
```

---

## Deliverables

Project builds successfully.

Frontend starts.

Backend starts.

Database connects.

Docker works.

---

## Exit Criteria

```
Backend Running

Frontend Running

Database Running

Authentication Ready To Build
```

---

# PHASE 1

# Authentication

---

## Objective

Secure the application.

---

## Backend Tasks

Implement

```
User Entity

User Repository

Authentication Service

JWT Utility

Security Config

Password Encryption
```

---

## APIs

Implement

```
POST

/auth/register

POST

/auth/login

GET

/auth/me

POST

/auth/logout
```

---

## Frontend

Create

```
Landing Page

Login

Register

Protected Routes

JWT Storage
```

---

## Testing

Verify

```
Registration

Login

Token Expiration

Unauthorized Access
```

---

## Deliverables

Users can

Register

Login

Logout

Access Protected Pages

---

## Exit Criteria

Authentication completely stable.

No work begins on Profile before Authentication passes.

---

# PHASE 2

# User Profile

---

## Objective

Collect user information.

---

## Backend

Create

```
Profile Entity

Profile Service

Profile Controller
```

---

## APIs

```
GET

/users/profile

PUT

/users/profile

PATCH

/users/preferences
```

---

## Frontend

Build

```
Onboarding Wizard

Profile Screen

Edit Profile
```

---

## Store

```
College

Branch

Semester

CGPA

Study Hours

Preferred Companies

Preferred Stack
```

---

## Validation

Semester

CGPA

Study Hours

Mandatory Fields

---

## Deliverables

First Time Setup

Editable Profile

Preferences Saved

---

## Exit Criteria

Dashboard has access to user profile.

---

# PHASE 3

# Academic Module

---

## Objective

Import academic information.

---

## Backend

Create

```
Academic Module

PDF Service

OCR Service

Extraction Service

Validation Service

Calendar Generator
```

---

## APIs

```
Upload Booklet

Get Calendar

Get Subjects

Get Semester

Booklet Status
```

---

## Frontend

Create

```
Academic Dashboard

Upload Screen

Calendar Screen

Subjects Screen
```

---

## AI

Integrate

```
PDF Extraction

Semester Extraction

Event Extraction

Subject Extraction
```

---

## Validation

Dates

Subjects

Credits

Semester

---

## Deliverables

Upload PDF

↓

Calendar Generated

↓

Subjects Imported

---

## Exit Criteria

Academic module fully functional.

Priority Engine not started until Academic module is complete.

---

# PHASE 4

# Placement Module

---

## Objective

Provide interview practice.

---

## Backend

Create

```
Mock Engine

Question Generator

Score Calculator

History Service
```

---

## APIs

```
Start Mock

Submit Mock

History

Results
```

---

## Frontend

Create

```
Mock Selection

Interview Screen

Score Screen

History Screen
```

---

## Mock Types

DSA

Technical

HR

Aptitude

---

## Deliverables

User completes mock.

Result stored.

History visible.

---

## Exit Criteria

Placement module complete.

Dashboard integration not started yet.

---

# End of Part 1

## Next Part

The next section of `implementation-roadmap.md` will cover:

- Phase 5 — Priority Engine
- Phase 6 — Dashboard Integration
- Phase 7 — Notifications & n8n
- Phase 8 — AI Layer
- Phase 9 — Testing Strategy
- Phase 10 — Production Deployment
- Final Definition of Done
---

# PHASE 5

# Priority Engine

## Objective

Build the core intelligence of CareerOS.

This phase implements the **Decision Engine**, which is the primary USP of the application.

No AI is involved in decision making.

---

## Responsibilities

The Priority Engine decides only:

- Academics
- Placement

It never decides

- Which chapter
- Which subject
- Which DSA topic
- Which technology

Those decisions always belong to the user.

---

## Backend Components

Create

```
PriorityService

PriorityCalculator

PriorityRuleEngine

RecommendationService

RecommendationRepository
```

---

## Input Sources

Academic Module

Placement Module

Current Date

Exam Timeline

Study Hours

Manual Override

---

## Output

```
Priority

Reason

Recommended Study Hours

Confidence
```

---

## APIs

```
GET

/dashboard/priority

POST

/dashboard/priority/override

GET

/dashboard/study-hours
```

---

## Business Rules

Example

```
Exam > 30 Days

↓

Placement Priority
```

---

Example

```
Exam ≤ 14 Days

↓

Academic Priority
```

---

Manual Override

```
Recommendation

↓

User Override

↓

Recommendation Updated

↓

Analytics Stored
```

---

## Deliverables

- Priority Engine
- Rule Engine
- Recommendation History
- Manual Override
- Unit Tests

---

## Exit Criteria

The engine consistently returns

Priority

Reason

Study Hours

without using AI.

---

# PHASE 6

# Dashboard Integration

---

## Objective

Integrate all completed modules into one dashboard.

---

## Dashboard Widgets

Today's Priority

Recommended Study Hours

Upcoming Academic Events

Recent Mock History

Notification Center

---

## Backend

Create

```
DashboardService

DashboardController

DashboardDTO
```

---

## Frontend

Create

```
Dashboard Page

Priority Card

Upcoming Events

Progress Card

Notification Panel
```

---

## API

```
GET

/dashboard
```

---

## Deliverables

Dashboard becomes the application's home page.

---

## Exit Criteria

Dashboard loads all modules using backend APIs only.

---

# PHASE 7

# Notifications & n8n

---

## Objective

Introduce background automation.

---

## n8n Responsibilities

Only orchestration.

Never business logic.

---

## Workflows

Workflow 1

Daily Reminder

---

Workflow 2

Weekly Summary

---

Workflow 3

Academic Import Complete

---

Workflow 4

Future Calendar Sync

---

## Backend

Create

```
NotificationService

NotificationController

NotificationRepository
```

---

## APIs

```
GET

/notifications

PATCH

/notifications/{id}/read

PATCH

/notifications/read-all
```

---

## Deliverables

Users receive

Daily Recommendation

Weekly Summary

Academic Alerts

---

## Exit Criteria

Notifications are fully event-driven.

No polling.

---

# PHASE 8

# AI Layer

---

## Objective

Integrate AI while keeping architecture protected.

---

## AI Responsibilities

Allowed

- PDF Extraction
- Mock Question Generation
- Recommendation Explanation

Forbidden

- Business Rules
- Database Writes
- Authentication
- Priority Decisions

---

## Backend Components

```
AIService

PromptBuilder

PromptTemplates

ResponseValidator

ConfidenceEvaluator
```

---

## Prompt Flow

```
Application

↓

Prompt Builder

↓

LLM

↓

Validation

↓

Application
```

---

## Deliverables

- PDF Extraction
- Mock Question Generation
- Explanation Generation

---

## Exit Criteria

AI remains completely isolated from business logic.

---

# PHASE 9

# Testing

---

## Objective

Ensure production readiness.

---

## Unit Tests

Authentication

Priority Engine

Academic Module

Placement Module

Notification Module

---

## Integration Tests

Authentication Flow

Academic Import

Mock Interview

Recommendation Engine

Dashboard

---

## End-to-End Tests

Landing Page

↓

Login

↓

Profile Setup

↓

Academic Upload

↓

Dashboard

↓

Placement Mock

↓

Notification

---

## Regression Tests

Verify

- Authentication
- Dashboard
- Academic Module
- Placement Module
- Notifications

Existing functionality must never break.

---

## Performance Tests

Measure

Dashboard

Authentication

Calendar

Mock Generation

Recommendation Generation

---

## Security Tests

JWT

Authorization

Validation

File Upload

Rate Limiting

---

## Deliverables

Complete automated testing suite.

---

## Exit Criteria

All tests pass.

---

# PHASE 10

# Production Deployment

---

## Objective

Deploy CareerOS to production.

---

## Infrastructure

Frontend

↓

Backend

↓

MySQL

↓

n8n

↓

Reverse Proxy

↓

HTTPS

---

## Production Checklist

Environment Variables

Database Migration

HTTPS

Logging

Monitoring

Backups

Health Checks

---

## Deployment Pipeline

```
GitHub

↓

CI

↓

Build

↓

Unit Tests

↓

Integration Tests

↓

Docker Image

↓

Deployment

↓

Health Check
```

Deployment stops if any critical stage fails.

---

# Definition of Done

A phase is complete only if

- Code Compiles
- APIs Tested
- UI Connected
- Database Migrated
- Validation Implemented
- Logging Added
- Documentation Updated
- Existing Features Verified
- Regression Tests Passed

---

# Release Strategy

## Alpha

Authentication

User Profile

Academic Import

---

## Beta

Placement Module

Priority Engine

Dashboard

---

## RC (Release Candidate)

Notifications

AI Layer

Performance

Security

---

## Production

Stable

Fully Tested

Documented

Deployable

---

# Implementation Order (Immutable)

```
Bootstrap

↓

Authentication

↓

User Profile

↓

Academic Module

↓

Placement Module

↓

Priority Engine

↓

Dashboard

↓

Notifications

↓

AI

↓

Testing

↓

Production
```

Never change this order unless the architecture document is updated.

---

# Engineering Gates

A phase cannot begin until the previous phase satisfies

- Architecture Review
- API Review
- Database Review
- Code Review
- Test Review

---

# Success Criteria

CareerOS V1 is considered complete when a student can

- Register and log in
- Complete onboarding
- Upload an academic booklet
- Automatically generate an academic calendar
- Take DSA, Technical, HR, and Aptitude mocks
- Receive a daily Academics vs Placement recommendation
- Override the recommendation if desired
- Receive meaningful notifications
- Use the system without any AI dependency for core business logic

---

# Final CTO Principles

1. Architecture over speed.
2. Stability over new features.
3. Simplicity over unnecessary complexity.
4. Business logic belongs only in Spring Boot.
5. AI augments the product; it never controls it.
6. Every phase must leave the project in a deployable state.
7. Never rewrite stable modules to implement new functionality.
8. Every feature must be modular, testable, and backward compatible.

---

# END OF DOCUMENT

Document Name

```
implementation-roadmap.md
```

Status

```
APPROVED
```