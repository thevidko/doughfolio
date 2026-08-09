import type { EnvStatusResponse } from "@shared/api.ts";
import { jsonError } from "../lib/http.ts";
import { type EnvRegistry, missingEnvVars } from "../services/env-requirements.ts";

/**
 * `GET /api/env-status?feature=…` — reports which required environment
 * variables are missing for a feature, so forms can block with an actionable
 * message (see docs/features/setup-wizard.md).
 */
export function createEnvStatusRoute(registry?: EnvRegistry) {
  return function envStatus(req: Request): Response {
    const feature = new URL(req.url).searchParams.get("feature");
    if (!feature) {
      return jsonError(400, "missing_feature_param", "errors.validation");
    }

    const missing = missingEnvVars(feature, registry);
    if (missing === null) {
      return jsonError(404, "unknown_feature", "errors.unknownFeature");
    }

    const body: EnvStatusResponse = { feature, missing };
    return Response.json(body);
  };
}
