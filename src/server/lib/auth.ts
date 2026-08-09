const COOKIE_NAME = "df_session";

/** Extract the session token from the request's Cookie header, if any. */
export function readSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
}

/**
 * Session cookie. No `Secure` flag on purpose: self-hosted instances commonly
 * run over plain HTTP on a LAN; TLS termination is the reverse proxy's job.
 */
export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
