import type { AssetDto } from "@shared/api.ts";
import { inArray, like, or, sql } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { assets } from "../db/schema.ts";
import { coingeckoFetch, type Fetcher } from "../lib/coingecko.ts";

const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_LIMIT = 25;
/** Ticker symbols collide ("btc" matches dozens of coins) — rank unknowns last. */
const UNRANKED = 1_000_000;

type CoinListEntry = { id: string; symbol: string; name: string };
type MarketEntry = { id: string; market_cap_rank: number | null };

function catalogAge(db: DbConn): number | null {
  const row = db
    .select({ refreshedAt: sql<string>`max(${assets.refreshedAt})` })
    .from(assets)
    .get();
  return row?.refreshedAt ? Date.now() - Date.parse(row.refreshedAt) : null;
}

/**
 * Refresh the cached CoinGecko coin catalog when empty or older than a week.
 * The full list carries no popularity signal, so a second request pulls the
 * top 250 by market cap and stamps their rank — that is what floats Bitcoin
 * above "batcat" for the query "btc". Failures are swallowed when a cache
 * exists (offline degradation); they propagate only with nothing to search.
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
    return;
  }

  try {
    const markets = await coingeckoFetch<MarketEntry[]>(
      "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1",
      fetchImpl,
    );
    db.transaction((tx) => {
      for (const entry of markets) {
        if (typeof entry.market_cap_rank !== "number") continue;
        tx.update(assets)
          .set({ marketCapRank: entry.market_cap_rank })
          .where(inArray(assets.id, [entry.id]))
          .run();
      }
    });
  } catch {
    // Ranking is an enhancement — search still works alphabetically without it.
    console.warn("Market-cap ranking refresh failed, search ranking degraded");
  }
}

/** Case-insensitive search, exact ticker matches ordered by market cap. */
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
    .limit(500)
    .all();

  const tier = (a: (typeof rows)[number]): number => {
    if (a.symbol.toLowerCase() === needle) return 0;
    if (a.id === needle) return 1;
    if (a.name.toLowerCase().startsWith(needle)) return 2;
    return 3;
  };
  return rows
    .sort(
      (a, b) =>
        tier(a) - tier(b) ||
        (a.marketCapRank ?? UNRANKED) - (b.marketCapRank ?? UNRANKED) ||
        a.name.length - b.name.length,
    )
    .slice(0, SEARCH_LIMIT)
    .map(({ id, symbol, name }) => ({ id, symbol, name }));
}
