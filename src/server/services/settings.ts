import { eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { settings } from "../db/schema.ts";

/** Known setting keys — extend the union when a feature adds a preference. */
export type SettingKey =
  | "language"
  | "baseCurrency"
  | "setupCompletedAt"
  | "stakingRewardCostBasis"
  | "costBasisMethod";

/** Read a setting; returns null when it has never been written. */
export function getSetting<T>(db: DbConn, key: SettingKey): T | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? (JSON.parse(row.value) as T) : null;
}

export function setSetting(db: DbConn, key: SettingKey, value: unknown): void {
  const encoded = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: encoded })
    .onConflictDoUpdate({ target: settings.key, set: { value: encoded } })
    .run();
}
