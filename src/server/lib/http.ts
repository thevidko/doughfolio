import type { ApiError } from "@shared/api.ts";
import type { z } from "zod";
import { ServiceError } from "./errors.ts";

/**
 * Build the uniform API error envelope (PLANNING #13).
 * `messageKey` must exist in the client i18n catalogs.
 */
export function jsonError(
  status: number,
  code: string,
  messageKey: string,
  details?: unknown,
): Response {
  const body: ApiError = {
    error: { code, messageKey, ...(details === undefined ? {} : { details }) },
  };
  return Response.json(body, { status });
}

/**
 * Parse and validate a JSON request body; throws a ServiceError carrying the
 * standard validation envelope (caught by `protectedRoute`).
 */
export async function readValidated<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new ServiceError(400, "validation_failed", "errors.validation", details);
  }
  return parsed.data;
}
