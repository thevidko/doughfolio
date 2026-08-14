import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Database schema (Drizzle + SQLite).
 *
 * Single-account for now, but every user-owned row references `users` so
 * multi-user becomes a migration, not a rewrite (PLANNING #4).
 * Timestamps are UTC ISO 8601 strings (PLANNING #17).
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  /** Argon2id hash via Bun.password; null = instance not password-protected. */
  passwordHash: text("password_hash"),
  createdAt: text("created_at").notNull(),
});

/** Key-value store for user preferences; values are JSON-encoded (PLANNING #18). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Wallet groups — "steamers" (wallet-structure spec). One level, no nesting. */
export const walletGroups = sqliteTable("wallet_groups", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  /** The auto-created themed group; renamable, never deletable. */
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

/**
 * Storage-style labels (hot, cold, …) — user-managed. `behavior: staking`
 * marks the built-in staked type whose balances count as staked funds.
 */
export const storageTypes = sqliteTable("storage_types", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  behavior: text("behavior", { enum: ["plain", "staking"] })
    .notNull()
    .default("plain"),
  /** Built-in types are renamable but not deletable (their behavior is load-bearing). */
  builtin: integer("builtin", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  /** Generic source kind (PLANNING #2); only `manual` is creatable in MVP. */
  kind: text("kind", { enum: ["manual", "wallet", "exchange"] }).notNull(),
  /** Nullable in SQL only for migration backfill — the app always assigns a group. */
  groupId: text("group_id").references(() => walletGroups.id),
  storageTypeId: text("storage_type_id").references(() => storageTypes.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

/**
 * Price-layer caches (portfolio-analytics spec, first slice). Pure cache —
 * droppable without data loss; no user_id on purpose.
 */
export const assets = sqliteTable("assets", {
  /** CoinGecko id — the canonical asset identifier (PLANNING #11). */
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  /** Market-cap position for search ranking (top coins only); null = long tail. */
  marketCapRank: integer("market_cap_rank"),
  refreshedAt: text("refreshed_at").notNull(),
});

export const spotPrices = sqliteTable("spot_prices", {
  /** Composite identity kept simple: one row per asset+currency pair. */
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  currency: text("currency").notNull(),
  price: text("price").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

/**
 * Transaction log — the single source of truth for balances and P/L
 * (manual-transactions spec; schema shipped early so wallet-deletion rules
 * are enforceable). Quantities/prices are decimal strings (PLANNING #9).
 */
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  walletId: text("wallet_id")
    .notNull()
    .references(() => wallets.id),
  type: text("type", {
    enum: ["buy", "sell", "transfer_in", "transfer_out", "reward"],
  }).notNull(),
  assetId: text("asset_id").notNull(),
  quantity: text("quantity").notNull(),
  unitPrice: text("unit_price"),
  priceCurrency: text("price_currency"),
  feeQuantity: text("fee_quantity"),
  feeAssetId: text("fee_asset_id"),
  /** Links the two rows of a wallet-to-wallet transfer; edited atomically. */
  transferGroupId: text("transfer_group_id"),
  occurredAt: text("occurred_at").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  /** Opaque random token, doubles as the primary key. */
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
});
