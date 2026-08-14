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
  /** Base currency for valuations (PLANNING #7), null before setup. */
  baseCurrency: string | null;
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

/** One row of the transaction log. Amounts are decimal strings (PLANNING #9). */
export type TransactionDto = {
  id: string;
  walletId: string;
  type: "buy" | "sell" | "transfer_in" | "transfer_out" | "reward";
  assetId: string;
  quantity: string;
  unitPrice: string | null;
  priceCurrency: string | null;
  feeQuantity: string | null;
  feeAssetId: string | null;
  /** Shared by both rows of a transfer; used for atomic edit/delete. */
  transferGroupId: string | null;
  occurredAt: string;
  note: string | null;
};

/** `GET /api/wallets/:id/transactions` — rows sorted by occurredAt ascending. */
export type TransactionListResponse = {
  transactions: TransactionDto[];
  /** Running balance of each row's own asset, aligned with `transactions`. */
  runningBalances: string[];
};

/** `GET /api/portfolio/balances` — everything the UI needs to show holdings. */
export type BalancesResponse = {
  /** walletId → assetId → balance. */
  wallets: Record<string, Record<string, string>>;
  /** assetId → total across all wallets. */
  totals: Record<string, string>;
  /** assetId → total in staking-behavior wallets. */
  staked: Record<string, string>;
  /** "walletId:assetId" pairs whose history dips below zero (UI warning). */
  overdrawn: string[];
};

/** One coin from the cached CoinGecko catalog. */
export type AssetDto = {
  id: string;
  symbol: string;
  name: string;
};

export type AssetSearchResponse = { assets: AssetDto[] };

/** `GET /api/prices/spot?assets=…&currency=…`. Prices are decimal strings. */
export type SpotPricesResponse = {
  currency: string;
  /** assetId → price; missing entries could not be quoted. */
  prices: Record<string, string>;
  /** True when at least one price came from an expired cache (offline). */
  stale: boolean;
};

/** `GET /api/portfolio/summary` — headline stats in the base currency. */
export type PortfolioSummaryResponse = {
  baseCurrency: string;
  costBasisMethod: "average" | "fifo";
  totalValue: string;
  costBasis: string;
  unrealized: string;
  realized: string;
  feesPaid: string;
  rewardsValue: string;
  /** Absolute change vs. yesterday's daily close; null when history is missing. */
  change24h: string | null;
  stale: boolean;
  /** Diagnostic list of prices the engine could not resolve (valued as 0). */
  missingPrices: string[];
};

/** `GET /api/portfolio/history?days=…` — chart series (numbers at the edge). */
export type PortfolioHistoryResponse = {
  baseCurrency: string;
  points: { date: string; value: number }[];
};

export type AllocationSlice = { key: string; label: string; value: number };

/** `GET /api/portfolio/allocation` — current value split three ways. */
export type PortfolioAllocationResponse = {
  baseCurrency: string;
  byAsset: AllocationSlice[];
  byGroup: AllocationSlice[];
  byStorageType: AllocationSlice[];
};

/** `GET /api/portfolio/asset/:assetId?days=…` — per-asset detail with trades. */
export type AssetDetailResponse = {
  assetId: string;
  baseCurrency: string;
  series: { date: string; price: number }[];
  markers: { date: string; type: TransactionDto["type"]; quantity: string }[];
  quantity: string;
  value: string | null;
  costBasis: string;
  realized: string;
  feesPaid: string;
  rewardsValue: string;
};

/** `GET/PATCH /api/settings` — user preferences (PLANNING #18). */
export type SettingsResponse = {
  language: string;
  baseCurrency: string;
  costBasisMethod: "average" | "fifo";
  stakingRewardCostBasis: "market" | "zero";
};
