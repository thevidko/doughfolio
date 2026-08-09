import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  /** Generic source kind (PLANNING #2); only `manual` is creatable in MVP. */
  kind: text("kind", { enum: ["manual", "wallet", "exchange"] }).notNull(),
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
