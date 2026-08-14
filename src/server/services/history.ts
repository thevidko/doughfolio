import { Decimal } from "@shared/money.ts";
import { and, eq, sql } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { historicalPrices } from "../db/schema.ts";
import { coingeckoFetch, type Fetcher } from "../lib/coingecko.ts";

/**
 * Daily historical closes (portfolio-analytics spec): the past is immutable,
 * so every (asset, currency, day) is fetched exactly once and cached forever.
 * Fiat→base conversion uses Bitcoin as a bridge (CoinGecko has BTC quotes in
 * every supported currency): eur→czk on a date = btc_czk / btc_eur.
 */

type MarketChart = { prices: [number, number][] };

export function utcDay(msOrIso: number | string): string {
  const date = typeof msOrIso === "number" ? new Date(msOrIso) : new Date(msOrIso);
  return date.toISOString().slice(0, 10);
}

function lastCachedDay(db: DbConn, assetId: string, currency: string): string | null {
  const row = db
    .select({ last: sql<string | null>`max(${historicalPrices.date})` })
    .from(historicalPrices)
    .where(and(eq(historicalPrices.assetId, assetId), eq(historicalPrices.currency, currency)))
    .get();
  return row?.last ?? null;
}

/** Fetch and cache missing daily closes for one (asset, currency) pair. */
export async function ensureDailyPrices(
  db: DbConn,
  assetId: string,
  currency: string,
  fetchImpl?: Fetcher,
): Promise<void> {
  const last = lastCachedDay(db, assetId, currency);
  const yesterday = utcDay(Date.now() - 86_400_000);
  if (last && last >= yesterday) return;

  // First fill pulls the full history in one request; later fills only the gap.
  const gapDays = last
    ? Math.min(365, Math.ceil((Date.now() - Date.parse(last)) / 86_400_000) + 1)
    : "max";
  const chart = await coingeckoFetch<MarketChart>(
    `/coins/${encodeURIComponent(assetId)}/market_chart?vs_currency=${encodeURIComponent(currency)}&days=${gapDays}&interval=daily`,
    fetchImpl,
  );

  db.transaction((tx) => {
    for (const [ms, price] of chart.prices) {
      const date = utcDay(ms);
      const id = `${assetId}:${currency}:${date}`;
      tx.insert(historicalPrices)
        .values({ id, assetId, currency, date, price: String(price) })
        .onConflictDoUpdate({ target: historicalPrices.id, set: { price: String(price) } })
        .run();
    }
  });
}

/**
 * In-memory lookup of cached daily prices with a small "nearest earlier day"
 * tolerance (weekends/gaps in provider data).
 */
export function loadPriceMap(
  db: DbConn,
  assetIds: readonly string[],
  currency: string,
): (assetId: string, date: string) => string | null {
  const rows = db
    .select()
    .from(historicalPrices)
    .where(eq(historicalPrices.currency, currency))
    .all()
    .filter((row) => assetIds.includes(row.assetId));

  const exact = new Map(rows.map((row) => [`${row.assetId}:${row.date}`, row.price]));
  return (assetId, date) => {
    for (let back = 0; back <= 7; back++) {
      const day = utcDay(Date.parse(date) - back * 86_400_000);
      const hit = exact.get(`${assetId}:${day}`);
      if (hit) return hit;
    }
    return null;
  };
}

/**
 * Build the pure price index the P/L engine consumes: asset prices in the
 * base currency plus fiat conversion via the BTC bridge.
 */
export async function buildPriceIndex(
  db: DbConn,
  input: {
    assetIds: readonly string[];
    quoteCurrencies: readonly string[];
    baseCurrency: string;
  },
  fetchImpl?: Fetcher,
) {
  const { assetIds, baseCurrency } = input;
  const quotes = [...new Set(input.quoteCurrencies)].filter((c) => c !== baseCurrency);

  for (const assetId of assetIds) {
    await ensureDailyPrices(db, assetId, baseCurrency, fetchImpl);
  }
  if (quotes.length > 0) {
    await ensureDailyPrices(db, "bitcoin", baseCurrency, fetchImpl);
    for (const currency of quotes) {
      await ensureDailyPrices(db, "bitcoin", currency, fetchImpl);
    }
  }

  const inBase = loadPriceMap(db, [...new Set([...assetIds, "bitcoin"])], baseCurrency);
  const btcInQuote = new Map(
    quotes.map((currency) => [currency, loadPriceMap(db, ["bitcoin"], currency)]),
  );

  return {
    assetPrice: (assetId: string, date: string) => inBase(assetId, date),
    fxToBase: (currency: string, date: string): string | null => {
      if (currency === baseCurrency) return "1";
      const btcBase = inBase("bitcoin", date);
      const btcQuote = btcInQuote.get(currency)?.("bitcoin", date);
      if (!btcBase || !btcQuote || new Decimal(btcQuote).isZero()) return null;
      return new Decimal(btcBase).div(btcQuote).toString();
    },
  };
}
