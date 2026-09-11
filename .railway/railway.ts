import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const rulevid = github("Brain-yark/rulevid", { checkSuites: false });

  const Postgres = postgres("Postgres", { region: "ams" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "ams", sizeMB: 500 });
  const backend = service("backend", {
    source: rulevid,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "backend/Dockerfile" },
    replicas: { "ams": 1 },
    env: { AGORA_API_KEY: preserve(), AGORA_API_SECRET: preserve(), AGORA_APP_CERTIFICATE: preserve(), AGORA_APP_ID: preserve(), AGORA_CHAT_APP_KEY: preserve(), AGORA_CHAT_APP_NAME: preserve(), AGORA_CHAT_ORG_NAME: preserve(), AGORA_CHAT_REST_API: preserve(), AGORA_CHAT_WEBSOCKET: preserve(), AGORA_CUSTOMER_ID: preserve(), DATABASE_URL: preserve(), FRONTEND_URL: preserve(), JWT_SECRET: preserve(), MAX_HOST_ACCOUNTS: preserve(), MAX_ROOM_CAPACITY: preserve(), MVP_MODE: preserve(), NODE_ENV: preserve(), PORT: preserve(), RESEND_API_KEY: preserve(), RESEND_FROM_EMAIL: preserve(), STRIPE_PUBLISHABLE_KEY: preserve(), STRIPE_SECRET_KEY: preserve(), STRIPE_WEBHOOK_SECRET: preserve() },
  });
  const frontend = service("frontend", {
    source: rulevid,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "frontend/Dockerfile" },
    replicas: { "ams": 1 },
    domains: [{ domain: "ruleboard.site", port: 80 }],
    env: { PORT: preserve(), VITE_AGORA_APP_ID: preserve(), VITE_AGORA_CHAT_APP_KEY: preserve(), VITE_AGORA_CHAT_WEBSOCKET: preserve(), VITE_API_URL: preserve() },
  });

  return project("zesty-forgiveness", {
    resources: [Postgres, backend, frontend, postgresVolume],
  });
});
