import type { SpotPricesResponse } from "@shared/api.ts";
import { and, eq, inArray } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { spotPrices } from "../db/schema.ts";
import { coingeckoFetch, type Fetcher } from "../lib/coingecko.ts";

const SPOT_TTL_MS = 60_000;

/**
 * Spot prices with a 60 s SQLite cache (PLANNING #1). Missing/expired pairs
 * are fetched in one batched request; when the network is down, expired cache
 * entries are served with `stale: true` — the UI must stay usable offline.
 */
export async function getSpotPrices(
  db: DbConn,
  assetIds: readonly string[],
  currency: string,
  fetchImpl?: Fetcher,
): Promise<SpotPricesResponse> {
  const unique = [...new Set(assetIds)].filter(Boolean);
  if (unique.length === 0) return { currency, prices: {}, stale: false };

  const cached = db
    .select()
    .from(spotPrices)
    .where(and(inArray(spotPrices.assetId, unique), eq(spotPrices.currency, currency)))
    .all();

  const now = Date.now();
  const fresh = new Map(
    cached
      .filter((row) => now - Date.parse(row.fetchedAt) < SPOT_TTL_MS)
      .map((row) => [row.assetId, row.price]),
  );
  const toFetch = unique.filter((id) => !fresh.has(id));

  let stale = false;
  if (toFetch.length > 0) {
    try {
      const quoted = await coingeckoFetch<Record<string, Record<string, number>>>(
        `/simple/price?ids=${encodeURIComponent(toFetch.join(","))}&vs_currencies=${encodeURIComponent(currency)}`,
        fetchImpl,
      );
      const fetchedAt = new Date().toISOString();
      for (const id of toFetch) {
        const value = quoted[id]?.[currency];
        if (value === undefined) continue;
        const price = String(value);
        fresh.set(id, price);
        db.insert(spotPrices)
          .values({ id: `${id}:${currency}`, assetId: id, currency, price, fetchedAt })
          .onConflictDoUpdate({ target: spotPrices.id, set: { price, fetchedAt } })
          .run();
      }
    } catch {
      // Offline degradation: fall back to whatever cache we have, however old.
      for (const row of cached) {
        if (!fresh.has(row.assetId)) {
          fresh.set(row.assetId, row.price);
          stale = true;
        }
      }
    }
  }

  return { currency, prices: Object.fromEntries(fresh), stale };
}
