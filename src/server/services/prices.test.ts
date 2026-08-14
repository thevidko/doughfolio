import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/index.ts";
import type { Fetcher } from "../lib/coingecko.ts";
import { searchAssets } from "./assets.ts";
import { getSpotPrices } from "./prices.ts";

function freshDb() {
  return openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
}

const jsonFetcher =
  (payload: unknown, calls?: { count: number }): Fetcher =>
  async () => {
    if (calls) calls.count += 1;
    return new Response(JSON.stringify(payload), { status: 200 });
  };

const failingFetcher: Fetcher = async () => new Response("nope", { status: 500 });

describe("searchAssets", () => {
  const COINS = [
    { id: "batcat", symbol: "btc", name: "batcat" },
    { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
    { id: "bitcoin-cash", symbol: "bch", name: "Bitcoin Cash" },
    { id: "batcoin", symbol: "bat", name: "Batcoin" },
  ];
  const MARKETS = [{ id: "bitcoin", market_cap_rank: 1 }];

  /** URL-aware fake: /coins/list vs /coins/markets. */
  const catalogFetcher =
    (calls?: { count: number }): Fetcher =>
    async (url) => {
      if (calls) calls.count += 1;
      const payload = url.includes("/coins/markets") ? MARKETS : COINS;
      return new Response(JSON.stringify(payload), { status: 200 });
    };

  it("caches the catalog and ranks exact tickers by market cap", async () => {
    const db = freshDb();
    const calls = { count: 0 };
    const results = await searchAssets(db, "btc", catalogFetcher(calls));
    // Both "batcat" and "bitcoin" have the ticker btc — market cap wins.
    expect(results[0]?.id).toBe("bitcoin");
    expect(calls.count).toBe(2);

    // Second search hits the cache — no further fetches.
    await searchAssets(db, "bitcoin", catalogFetcher(calls));
    expect(calls.count).toBe(2);
  });

  it("serves the cached catalog when the refresh fails", async () => {
    const db = freshDb();
    await searchAssets(db, "btc", catalogFetcher());
    const results = await searchAssets(db, "bitcoin cash", failingFetcher);
    expect(results.map((a) => a.id)).toContain("bitcoin-cash");
  });

  it("propagates the failure when there is no cache at all", async () => {
    const db = freshDb();
    await expect(searchAssets(db, "btc", failingFetcher)).rejects.toThrow();
  });
});

describe("getSpotPrices", () => {
  it("fetches, caches and reuses prices within the TTL", async () => {
    const db = freshDb();
    const calls = { count: 0 };
    const fetcher = jsonFetcher({ bitcoin: { usd: 64123.5 } }, calls);

    const first = await getSpotPrices(db, ["bitcoin"], "usd", fetcher);
    expect(first.prices.bitcoin).toBe("64123.5");
    expect(first.stale).toBe(false);

    const second = await getSpotPrices(db, ["bitcoin"], "usd", failingFetcher);
    expect(second.prices.bitcoin).toBe("64123.5");
    expect(second.stale).toBe(false);
    expect(calls.count).toBe(1);
  });

  it("serves stale cache with a flag when the network is down", async () => {
    const db = freshDb();
    await getSpotPrices(db, ["bitcoin"], "usd", jsonFetcher({ bitcoin: { usd: 100 } }));
    // Expire the cache manually.
    const { spotPrices } = await import("../db/schema.ts");
    db.update(spotPrices)
      .set({ fetchedAt: new Date(Date.now() - 10 * 60_000).toISOString() })
      .run();

    const result = await getSpotPrices(db, ["bitcoin"], "usd", failingFetcher);
    expect(result.prices.bitcoin).toBe("100");
    expect(result.stale).toBe(true);
  });

  it("omits assets the API cannot quote", async () => {
    const db = freshDb();
    const result = await getSpotPrices(
      db,
      ["bitcoin", "unknowncoin"],
      "usd",
      jsonFetcher({ bitcoin: { usd: 1 } }),
    );
    expect(result.prices.bitcoin).toBe("1");
    expect(result.prices.unknowncoin).toBeUndefined();
  });
});
