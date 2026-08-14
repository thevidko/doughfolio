import { jsonError } from "./http.ts";

/**
 * Domain-rule violation thrown by services and translated to the shared
 * error envelope by routes (PLANNING #13).
 */
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = "ServiceError";
  }

  toResponse(): Response {
    return jsonError(this.status, this.code, this.messageKey, this.details);
  }
}

export const notFound = () => new ServiceError(404, "not_found", "errors.notFound");
