import type { SetupCompleteResponse, SetupStatusResponse } from "@shared/api.ts";
import { setupCompleteSchema } from "@shared/schemas/setup.ts";
import type { Db } from "../db/index.ts";
import { readSessionToken, sessionCookie } from "../lib/auth.ts";
import { jsonError } from "../lib/http.ts";
import { getSessionUser, SESSION_TTL_SECONDS } from "../services/sessions.ts";
import { getSetting } from "../services/settings.ts";
import { completeSetup, getUser, isSetupCompleted } from "../services/setup.ts";

/** Routes owning the first-run setup flow (see docs/features/setup-wizard.md). */
export function createSetupRoutes(db: Db) {
  function status(req: Request): Response {
    const completed = isSetupCompleted(db);
    const user = getUser(db);
    const passwordRequired = Boolean(user?.passwordHash);

    let authenticated = !passwordRequired;
    if (passwordRequired) {
      const token = readSessionToken(req);
      authenticated = token !== null && getSessionUser(db, token) !== null;
    }

    const body: SetupStatusResponse = {
      completed,
      passwordRequired,
      authenticated,
      language: getSetting<string>(db, "language"),
      // The display name is only revealed to authenticated visitors.
      displayName: authenticated ? (user?.displayName ?? null) : null,
      baseCurrency: getSetting<string>(db, "baseCurrency"),
    };
    return Response.json(body);
  }

  async function complete(req: Request): Promise<Response> {
    if (isSetupCompleted(db)) {
      return jsonError(409, "setup_already_completed", "errors.setupAlreadyCompleted");
    }

    const parsed = setupCompleteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return jsonError(400, "validation_failed", "errors.validation", details);
    }

    const { sessionToken } = await completeSetup(db, parsed.data);

    const body: SetupCompleteResponse = { ok: true };
    const headers = new Headers();
    if (sessionToken) {
      headers.set("Set-Cookie", sessionCookie(sessionToken, SESSION_TTL_SECONDS));
    }
    return Response.json(body, { headers });
  }

  return { status, complete };
}
