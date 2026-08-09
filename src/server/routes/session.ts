import type { SessionResponse } from "@shared/api.ts";
import { loginSchema } from "@shared/schemas/setup.ts";
import type { Db } from "../db/index.ts";
import { clearSessionCookie, readSessionToken, sessionCookie } from "../lib/auth.ts";
import { jsonError } from "../lib/http.ts";
import {
  createSession,
  destroySession,
  getSessionUser,
  SESSION_TTL_SECONDS,
} from "../services/sessions.ts";
import { getUser } from "../services/setup.ts";

/** Login/logout for password-protected instances. */
export function createSessionRoutes(db: Db) {
  function currentUser(req: Request) {
    const token = readSessionToken(req);
    return token ? getSessionUser(db, token) : null;
  }

  function get(req: Request): Response {
    const user = currentUser(req);
    const body: SessionResponse = {
      authenticated: user !== null,
      displayName: user?.displayName ?? null,
    };
    return Response.json(body);
  }

  async function login(req: Request): Promise<Response> {
    const parsed = loginSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(400, "validation_failed", "errors.validation");
    }

    const user = getUser(db);
    if (!user?.passwordHash) {
      return jsonError(400, "no_password_set", "errors.noPasswordSet");
    }

    const valid = await Bun.password.verify(parsed.data.password, user.passwordHash);
    if (!valid) {
      return jsonError(401, "invalid_credentials", "errors.invalidPassword");
    }

    const token = createSession(db, user.id);
    const body: SessionResponse = {
      authenticated: true,
      displayName: user.displayName ?? null,
    };
    return Response.json(body, {
      headers: { "Set-Cookie": sessionCookie(token, SESSION_TTL_SECONDS) },
    });
  }

  function logout(req: Request): Response {
    const token = readSessionToken(req);
    if (token) destroySession(db, token);
    return Response.json({ authenticated: false, displayName: null } satisfies SessionResponse, {
      headers: { "Set-Cookie": clearSessionCookie() },
    });
  }

  return { get, login, logout };
}
