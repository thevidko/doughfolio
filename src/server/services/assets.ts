import type { AssetDto } from "@shared/api.ts";
import { like, or, sql } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { assets } from "../db/schema.ts";
import { coingeckoFetch, type Fetcher } from "../lib/coingecko.ts";

const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_LIMIT = 25;

type CoinListEntry = { id: string; symbol: string; name: string };

function catalogAge(db: DbConn): number | null {
  const row = db
    .select({ refreshedAt: sql<string>`max(${assets.refreshedAt})` })
    .from(assets)
    .get();
  return row?.refreshedAt ? Date.now() - Date.parse(row.refreshedAt) : null;
}

/**
 * Refresh the cached CoinGecko coin catalog when empty or older than a week.
 * Failures are swallowed when a cache exists (offline degradation — spec);
 * they propagate only when there is nothing to search at all.
 */
export async function ensureAssetCatalog(db: DbConn, fetchImpl?: Fetcher): Promise<void> {
  const age = catalogAge(db);
  if (age !== null && age < CATALOG_TTL_MS) return;

  try {
    const list = await coingeckoFetch<CoinListEntry[]>("/coins/list", fetchImpl);
    const now = new Date().toISOString();
    db.transaction((tx) => {
      tx.delete(assets).run();
      // Chunked inserts — the list has ~19k coins, SQLite limits bound variables.
      const CHUNK = 500;
      for (let i = 0; i < list.length; i += CHUNK) {
        tx.insert(assets)
          .values(
            list.slice(i, i + CHUNK).map((coin) => ({
              id: coin.id,
              symbol: coin.symbol,
              name: coin.name,
              refreshedAt: now,
            })),
          )
          .run();
      }
    });
  } catch (error) {
    if (age === null) throw error;
    // Stale catalog beats no catalog; the weekly refresh will retry.
    console.warn("Asset catalog refresh failed, serving cached data");
  }
}

/** Case-insensitive search over the cached catalog, exact ticker match first. */
export async function searchAssets(
  db: DbConn,
  query: string,
  fetchImpl?: Fetcher,
): Promise<AssetDto[]> {
  await ensureAssetCatalog(db, fetchImpl);

  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const pattern = `%${needle}%`;

  const rows = db
    .select()
    .from(assets)
    .where(or(like(assets.id, pattern), like(assets.symbol, pattern), like(assets.name, pattern)))
    .limit(200)
    .all();

  const rank = (a: (typeof rows)[number]): number => {
    if (a.symbol.toLowerCase() === needle) return 0;
    if (a.id === needle) return 1;
    if (a.name.toLowerCase().startsWith(needle)) return 2;
    return 3;
  };
  return rows
    .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length)
    .slice(0, SEARCH_LIMIT)
    .map(({ id, symbol, name }) => ({ id, symbol, name }));
}
