import type { Db } from "../db/index.ts";
import { getSessionUser } from "../services/sessions.ts";
import { getUser } from "../services/setup.ts";
import { readSessionToken } from "./auth.ts";
import { ServiceError } from "./errors.ts";
import { jsonError } from "./http.ts";

/**
 * Session gate for data routes: on password-protected instances a valid
 * session cookie is required; unprotected instances pass through (the
 * self-hoster opted out of app-level auth — see PLANNING #4).
 * Returns the 401 response to send, or null when the request may proceed.
 */
export function requireAuth(db: Db, req: Request): Response | null {
  const user = getUser(db);
  if (!user?.passwordHash) return null;

  const token = readSessionToken(req);
  if (token && getSessionUser(db, token)) return null;

  return jsonError(401, "unauthorized", "errors.unauthorized");
}

type RouteHandler = (req: Request, id: string) => Response | Promise<Response>;

/**
 * Wrapper for data routes: enforces the session gate and converts thrown
 * `ServiceError`s into the shared error envelope. Anything else bubbles up —
 * a real bug should be loud, not wrapped.
 */
export function protectedRoute(db: Db, handler: RouteHandler) {
  return async (req: Request, id = ""): Promise<Response> => {
    const denied = requireAuth(db, req);
    if (denied) return denied;
    try {
      return await handler(req, id);
    } catch (error) {
      if (error instanceof ServiceError) return error.toResponse();
      throw error;
    }
  };
}
