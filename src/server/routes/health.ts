import type { HealthResponse } from "@shared/api.ts";
import pkg from "../../../package.json";

/**
 * `GET /api/health` — liveness probe.
 *
 * Used by the frontend to verify connectivity and by container orchestrators
 * (Docker healthcheck, Kubernetes probes) to monitor the instance.
 */
export function healthRoute(): Response {
  const body: HealthResponse = {
    status: "ok",
    name: pkg.name,
    version: pkg.version,
    timestamp: new Date().toISOString(),
  };
  return Response.json(body);
}
