/**
 * Shared API contract between the server and the client.
 *
 * Every JSON shape that crosses the HTTP boundary must be defined here so the
 * frontend and backend can never drift apart. Import via the `@shared/*` alias.
 */

/** Response body of `GET /api/health`. */
export type HealthResponse = {
  status: "ok";
  /** Application name, useful when multiple self-hosted services run side by side. */
  name: string;
  /** Semantic version of the running server, taken from package.json. */
  version: string;
  /** ISO 8601 timestamp of when the response was generated. */
  timestamp: string;
};
