# RAG Service

This is the standalone Spring Boot application for the Retrieval-Augmented Generation (RAG) capabilities of CareerOS.

**Note:** This is currently an empty skeleton service created as Phase 2 of a migration effort. It contains no business logic yet.

## Prerequisites
- Java 21
- Maven

## How to run
```bash
mvn spring-boot:run
```

## Health Endpoint
The service exposes a simple health endpoint to verify it is running:
```bash
curl http://localhost:8081/health
```
