import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const backend = service("backend", {
    source: github("KalpataruDash2005/Nexux", {
      branch: "phase-15-bug-fixes",
      rootDirectory: "backend",
    }),
    replicas: { "sfo": 1 },
    healthcheck: "/api/v1/health",
    healthcheckTimeout: 300,
    env: {
      CAREEROS_ADMIN_EMAIL: preserve(),
      CAREEROS_ADMIN_PASSWORD: preserve(),
      DB_HOST: preserve(),
      DB_NAME: preserve(),
      DB_PASSWORD: preserve(),
      DB_PORT: preserve(),
      DB_USER: preserve(),
      JWT_SECRET: preserve(),
      OAUTH_COOKIE_SECRET: preserve(),
      PDF_ASSISTANT_N8N_ENABLED: preserve(),
      SPRING_PROFILES_ACTIVE: preserve(),
    },
  });

  return project("careeros-backend", {
    resources: [backend],
  });
});
