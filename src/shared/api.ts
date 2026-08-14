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

/**
 * Uniform error envelope returned by every API endpoint on failure
 * (PLANNING #13). `messageKey` is an i18n key so the client renders the
 * message in the active language; `code` is stable and machine-readable.
 */
export type ApiError = {
  error: {
    code: string;
    messageKey: string;
    details?: unknown;
  };
};

/** Response body of `GET /api/setup/status`. */
export type SetupStatusResponse = {
  /** Whether the first-run setup wizard has been completed. */
  completed: boolean;
  /** Whether a password protects this instance. */
  passwordRequired: boolean;
  /** True when the request carries a valid session, or no password is set. */
  authenticated: boolean;
  /** Stored UI language (BCP 47 short code), null before setup. */
  language: string | null;
  /** Display name for greetings, null when the user skipped it or pre-setup. */
  displayName: string | null;
};

/** Response body of `POST /api/setup/complete`. */
export type SetupCompleteResponse = { ok: true };

/** Response body of `GET/POST /api/session`. */
export type SessionResponse = {
  authenticated: boolean;
  displayName: string | null;
};

/** Response body of `GET /api/env-status?feature=…` (see setup-wizard spec). */
export type EnvStatusResponse = {
  feature: string;
  /** Names of required environment variables that are not set. */
  missing: string[];
};

/** A wallet group — a "steamer" (wallet-structure spec). */
export type WalletGroupDto = {
  id: string;
  name: string;
  /** The auto-created themed group; renamable, never deletable. */
  isDefault: boolean;
  sortOrder: number;
};

/** A storage-style label; `behavior: "staking"` marks staked funds. */
export type StorageTypeDto = {
  id: string;
  name: string;
  behavior: "plain" | "staking";
  /** Built-in types are renamable but not deletable. */
  builtin: boolean;
  sortOrder: number;
};

/** A wallet — a "basket" inside a steamer. */
export type WalletDto = {
  id: string;
  name: string;
  kind: "manual" | "wallet" | "exchange";
  groupId: string;
  storageTypeId: string | null;
  sortOrder: number;
};

export type WalletGroupListResponse = { groups: WalletGroupDto[] };
export type StorageTypeListResponse = { storageTypes: StorageTypeDto[] };
export type WalletListResponse = { wallets: WalletDto[] };
