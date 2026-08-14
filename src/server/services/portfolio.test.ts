import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/index.ts";
import type { Fetcher } from "../lib/coingecko.ts";
import { completeSetup } from "../services/setup.ts";
import { createTransaction } from "../services/transactions.ts";
import { listWallets } from "../services/wallets.ts";
import { getPortfolioAllocation, getPortfolioHistory, getPortfolioSummary } from "./portfolio.ts";

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

/**
 * Fake CoinGecko: bitcoin flat at 1,000,000 CZK (history + spot).
 * market_chart returns 400 daily points ending today.
 */
const fakeGecko: Fetcher = async (url) => {
  if (url.includes("/market_chart")) {
    const points: [number, number][] = [];
    for (let i = 399; i >= 0; i--) {
      points.push([Date.now() - i * DAY_MS, 1_000_000]);
    }
    return new Response(JSON.stringify({ prices: points }), { status: 200 });
  }
  if (url.includes("/simple/price")) {
    return new Response(JSON.stringify({ bitcoin: { czk: 1_100_000 } }), { status: 200 });
  }
  return new Response(JSON.stringify([]), { status: 200 });
};

async function instance() {
  const db = openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
  await completeSetup(db, {
    language: "cs",
    baseCurrency: "czk",
    wallets: [{ name: "Hot" }, { name: "Cold" }],
  });
  const [hot] = listWallets(db);
  if (!hot) throw new Error("wallet missing");

  createTransaction(db, {
    type: "buy",
    walletId: hot.id,
    assetId: "bitcoin",
    quantity: "1",
    unitPrice: "800000",
    priceCurrency: "czk",
    occurredAt: daysAgo(10),
  });
  createTransaction(db, {
    type: "sell",
    walletId: hot.id,
    assetId: "bitcoin",
    quantity: "0.5",
    unitPrice: "1000000",
    priceCurrency: "czk",
    occurredAt: daysAgo(5),
  });
  return { db, hot };
}

describe("getPortfolioSummary", () => {
  it("combines the P/L engine with spot prices", async () => {
    const { db } = await instance();
    const summary = await getPortfolioSummary(db, fakeGecko);

    expect(summary.baseCurrency).toBe("czk");
    // 0.5 BTC × 1,100,000 spot.
    expect(summary.totalValue).toBe("550000");
    // Bought at 800k, half sold at 1M → realized +100,000.
    expect(summary.realized).toBe("100000");
    // Open basis 0.5 × 800,000 = 400,000 → unrealized 150,000.
    expect(summary.unrealized).toBe("150000");
    // Yesterday's close 1,000,000 → change = 550,000 − 500,000.
    expect(summary.change24h).toBe("50000");
    expect(summary.missingPrices).toEqual([]);
  });
});

describe("getPortfolioHistory", () => {
  it("builds a daily value series from balances × daily closes", async () => {
    const { db } = await instance();
    const history = await getPortfolioHistory(db, null, fakeGecko);

    expect(history.points.length).toBe(11);
    expect(history.points[0]?.value).toBe(1_000_000);
    expect(history.points.at(-1)?.value).toBe(500_000);
  });

  it("respects the range parameter", async () => {
    const { db } = await instance();
    const history = await getPortfolioHistory(db, 3, fakeGecko);
    expect(history.points.length).toBe(4);
    for (const point of history.points) {
      expect(point.value).toBe(500_000);
    }
  });
});

describe("getPortfolioAllocation", () => {
  it("splits value by asset, group and storage type", async () => {
    const { db } = await instance();
    const allocation = await getPortfolioAllocation(db, fakeGecko);

    expect(allocation.byAsset).toEqual([{ key: "bitcoin", label: "bitcoin", value: 550_000 }]);
    expect(allocation.byGroup[0]?.label).toBe("Napařovák");
    expect(allocation.byGroup[0]?.value).toBe(550_000);
    // No storage type assigned → the "—" bucket.
    expect(allocation.byStorageType[0]?.label).toBe("—");
  });
});
