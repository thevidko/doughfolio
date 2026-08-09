import type { ApiError } from "@shared/api.ts";

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
