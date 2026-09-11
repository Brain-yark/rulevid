import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const rulevid = github("Brain-yark/rulevid", { checkSuites: false });

  const Postgres = postgres("Postgres", { region: "ams" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "ams", sizeMB: 500 });
  const backend = service("backend", {
    source: rulevid,
    replicas: { "ams": 1 },
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "backend/Dockerfile",
    },
    env: { NODE_ENV: preserve() },
  });
  const frontend = service("frontend", {
    source: rulevid,
    replicas: { "ams": 1 },
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "frontend/Dockerfile",
    },
  });

  return project("zesty-forgiveness", {
    resources: [Postgres, backend, frontend, postgresVolume],
  });
});
