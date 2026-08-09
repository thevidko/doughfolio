import type { ApiError } from "@shared/api.ts";

/** Typed failure thrown by `apiFetch` — `messageKey` feeds straight into i18n. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = "ApiRequestError";
  }
}

/** Fetch wrapper understanding the shared error envelope (PLANNING #13). */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiRequestError(0, "network_unreachable", "errors.network");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      res.status,
      body?.error.code ?? "unknown_error",
      body?.error.messageKey ?? "errors.network",
      body?.error.details,
    );
  }
  return res.json() as Promise<T>;
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
