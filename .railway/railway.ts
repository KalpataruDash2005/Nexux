import { defineRailway, github, image, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const qdrantData = volume("qdrant-data", {
    region: "us-west2",
    sizeMB: 500,
  });

  const qdrant = service("qdrant", {
    source: image("qdrant/qdrant:v1.12.6"),
    replicas: { "us-west2": 1 },
    volumeMounts: {
      "/qdrant/storage": qdrantData,
    },
  });

  const backend = service("backend", {
    source: github("KalpataruDash2005/Nexux", {
      branch: "phase-15-bug-fixes",
      rootDirectory: "backend",
    }),
    replicas: { "us-west2": 1 },
    healthcheck: "/api/v1/health",
    healthcheckTimeout: 300,
    env: {
      APP_CORS_ALLOWED_ORIGINS: preserve(),
      CAREEROS_ADMIN_EMAIL: preserve(),
      CAREEROS_ADMIN_PASSWORD: preserve(),
      DB_HOST: preserve(),
      DB_NAME: preserve(),
      DB_PASSWORD: preserve(),
      DB_PORT: preserve(),
      DB_USER: preserve(),
      FRONTEND_URL: preserve(),
      GEMINI_API_KEY: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      JWT_SECRET: preserve(),
      N8N_WEBHOOK_URL: preserve(),
      OAUTH_COOKIE_SECRET: preserve(),
      OPENAI_API_KEY: preserve(),
      OPENAI_BASE_URL: preserve(),
      PDF_ASSISTANT_INTERNAL_KEY: preserve(),
      PDF_ASSISTANT_N8N_ENABLED: preserve(),
      SPRING_DATASOURCE_HIKARI_MAX_LIFETIME: preserve(),
      SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: preserve(),
      SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE: preserve(),
      SPRING_PROFILES_ACTIVE: preserve(),
      QDRANT_HOST: qdrant.env.RAILWAY_PRIVATE_DOMAIN,
      QDRANT_PORT: "6334",
      QDRANT_REST_PORT: "6333",
    },
  });

  return project("careeros-backend", {
    resources: [backend, qdrant, qdrantData],
  });
});
