# CareerOS Monorepo

CareerOS is an ecosystem designed to optimize academic progress and placement readiness for university students.

## Monorepo Layout

```text
CareerOS/
  ├── frontend/    # React Application with TailwindCSS & TS
  ├── backend/     # Spring Boot Rest API (Java 21, Maven)
  ├── docs/        # Architecture, API specifications, and design guidelines
  ├── docker/      # Local infrastructure configuration (MySQL, n8n)
  └── scripts/     # Convenience developer operations scripts
```

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Java JDK 21
- Maven 3.8+
- Docker & Docker Compose

### Getting Started
1. Copy the environment files:
   - Root: `cp .env.example .env`
   - Frontend: `cp frontend/.env.example frontend/.env`
   - Backend: `cp backend/.env.example backend/.env`
2. Spin up the infrastructure using Docker:
   - Run `docker compose -f docker/docker-compose.yml up -d` or use the scripts provided in future phases.
3. Start the backend application.
4. Start the frontend development server.
