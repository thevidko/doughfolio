import { eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { sessions, users } from "../db/schema.ts";

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createSession(db: DbConn, userId: string): string {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  db.insert(sessions).values({ id: token, userId, expiresAt }).run();
  return token;
}

/**
 * Resolve a session token to its user. Expired sessions are deleted lazily
 * on access — no background cleanup job needed at this scale.
 */
export function getSessionUser(db: DbConn, token: string) {
  const row = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .get();
  if (!row) return null;

  if (row.session.expiresAt <= new Date().toISOString()) {
    db.delete(sessions).where(eq(sessions.id, token)).run();
    return null;
  }
  return row.user;
}

export function destroySession(db: DbConn, token: string): void {
  db.delete(sessions).where(eq(sessions.id, token)).run();
}
