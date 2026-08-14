import type {
  AssetDetailResponse,
  PortfolioAllocationResponse,
  PortfolioHistoryResponse,
  PortfolioSummaryResponse,
} from "@shared/api.ts";
import { assetTotals, walletAssetBalances } from "@shared/balances.ts";
import { Decimal } from "@shared/money.ts";
import { computePl, type PlMethod, type RewardBasis } from "@shared/pl.ts";
import type { DbConn } from "../db/index.ts";
import { storageTypes, walletGroups, wallets } from "../db/schema.ts";
import type { Fetcher } from "../lib/coingecko.ts";
import { buildPriceIndex, ensureDailyPrices, loadPriceMap, utcDay } from "./history.ts";
import { getSpotPrices } from "./prices.ts";
import { getSetting } from "./settings.ts";
import { listAllTransactions } from "./transactions.ts";

const DAY_MS = 86_400_000;

function readConfig(db: DbConn) {
  return {
    baseCurrency: getSetting<string>(db, "baseCurrency") ?? "usd",
    method: (getSetting<string>(db, "costBasisMethod") ?? "average") as PlMethod,
    rewardBasis: (getSetting<string>(db, "stakingRewardCostBasis") ?? "market") as RewardBasis,
  };
}

function involvedAssets(txs: ReturnType<typeof listAllTransactions>): string[] {
  const ids = new Set<string>();
  for (const tx of txs) {
    ids.add(tx.assetId);
    if (tx.feeAssetId) ids.add(tx.feeAssetId);
  }
  return [...ids];
}

/** Headline stats: total value, unrealized/realized P/L, fees, rewards. */
export async function getPortfolioSummary(
  db: DbConn,
  fetchImpl?: Fetcher,
): Promise<PortfolioSummaryResponse> {
  const { baseCurrency, method, rewardBasis } = readConfig(db);
  const txs = listAllTransactions(db);
  const assetIds = involvedAssets(txs);
  const quoteCurrencies = [
    ...new Set(txs.map((t) => t.priceCurrency).filter((c): c is string => Boolean(c))),
  ];

  const prices = await buildPriceIndex(db, { assetIds, quoteCurrencies, baseCurrency }, fetchImpl);
  const pl = computePl(txs, { method, rewardBasis, prices });
  const spot = await getSpotPrices(db, assetIds, baseCurrency, fetchImpl);

  let totalValue = new Decimal(0);
  let yesterdayValue = new Decimal(0);
  let missingYesterday = false;
  const yesterday = utcDay(Date.now() - DAY_MS);
  for (const asset of pl.assets.values()) {
    const qty = new Decimal(asset.quantity);
    if (qty.isZero()) continue;
    const spotPrice = spot.prices[asset.assetId];
    if (spotPrice) totalValue = totalValue.plus(qty.times(spotPrice));
    const closing = prices.assetPrice(asset.assetId, yesterday);
    if (closing) yesterdayValue = yesterdayValue.plus(qty.times(closing));
    else missingYesterday = true;
  }

  return {
    baseCurrency,
    costBasisMethod: method,
    totalValue: totalValue.toString(),
    costBasis: pl.totals.costBasis,
    unrealized: totalValue.minus(pl.totals.costBasis).toString(),
    realized: pl.totals.realized,
    feesPaid: pl.totals.feesPaid,
    rewardsValue: pl.totals.rewardsValue,
    change24h: missingYesterday ? null : totalValue.minus(yesterdayValue).toString(),
    stale: spot.stale,
    missingPrices: pl.missingPrices,
  };
}

/** Daily portfolio value series for the area chart. `days` null = all time. */
export async function getPortfolioHistory(
  db: DbConn,
  days: number | null,
  fetchImpl?: Fetcher,
): Promise<PortfolioHistoryResponse> {
  const { baseCurrency } = readConfig(db);
  const txs = listAllTransactions(db);
  if (txs.length === 0) return { baseCurrency, points: [] };

  const assetIds = involvedAssets(txs);
  for (const assetId of assetIds) {
    try {
      await ensureDailyPrices(db, assetId, baseCurrency, fetchImpl);
    } catch {
      // Degrade per asset: it simply contributes no value to the series.
      console.warn(`History prices unavailable for ${assetId}`);
    }
  }
  const priceOf = loadPriceMap(db, assetIds, baseCurrency);

  // Per-day quantity deltas per asset (fees included), then one forward walk.
  const deltas = new Map<string, Map<string, Decimal>>();
  const bump = (date: string, assetId: string, delta: Decimal) => {
    let forDay = deltas.get(date);
    if (!forDay) {
      forDay = new Map();
      deltas.set(date, forDay);
    }
    forDay.set(assetId, (forDay.get(assetId) ?? new Decimal(0)).plus(delta));
  };
  for (const tx of txs) {
    const date = utcDay(tx.occurredAt);
    const qty = new Decimal(tx.quantity);
    const inflow = tx.type === "buy" || tx.type === "transfer_in" || tx.type === "reward";
    bump(date, tx.assetId, inflow ? qty : qty.negated());
    if (tx.feeQuantity && tx.feeAssetId) {
      bump(date, tx.feeAssetId, new Decimal(tx.feeQuantity).negated());
    }
  }

  const firstDay = utcDay((txs[0] as (typeof txs)[number]).occurredAt);
  const startDay = days ? utcDay(Date.now() - days * DAY_MS) : firstDay;
  const today = utcDay(Date.now());

  const holdings = new Map<string, Decimal>();
  const points: { date: string; value: number }[] = [];
  for (let ms = Date.parse(firstDay); ms <= Date.parse(today); ms += DAY_MS) {
    const date = utcDay(ms);
    const forDay = deltas.get(date);
    if (forDay) {
      for (const [assetId, delta] of forDay) {
        holdings.set(assetId, (holdings.get(assetId) ?? new Decimal(0)).plus(delta));
      }
    }
    if (date < startDay) continue;

    let value = new Decimal(0);
    for (const [assetId, qty] of holdings) {
      if (qty.isZero()) continue;
      const price = priceOf(assetId, date);
      if (price) value = value.plus(qty.times(price));
    }
    // Chart edge — numbers are allowed here (PLANNING #9).
    points.push({ date, value: Number(value.toFixed(2)) });
  }

  return { baseCurrency, points };
}

/** Current value split by asset, steamer and storage type (donut data). */
export async function getPortfolioAllocation(
  db: DbConn,
  fetchImpl?: Fetcher,
): Promise<PortfolioAllocationResponse> {
  const { baseCurrency } = readConfig(db);
  const txs = listAllTransactions(db);
  const balances = walletAssetBalances(txs);
  const totals = assetTotals(balances);
  const spot = await getSpotPrices(db, [...totals.keys()], baseCurrency, fetchImpl);

  const sliceValue = (assetId: string, qty: string): Decimal => {
    const price = spot.prices[assetId];
    return price ? new Decimal(qty).times(price) : new Decimal(0);
  };

  const byAsset = [...totals]
    .map(([assetId, qty]) => ({
      key: assetId,
      label: assetId,
      value: Number(sliceValue(assetId, qty).toFixed(2)),
    }))
    .filter((slice) => slice.value > 0);

  const walletRows = db.select().from(wallets).all();
  const groupRows = db.select().from(walletGroups).all();
  const typeRows = db.select().from(storageTypes).all();

  const groupValues = new Map<string, Decimal>();
  const typeValues = new Map<string, Decimal>();
  for (const [walletId, assets] of balances) {
    const wallet = walletRows.find((w) => w.id === walletId);
    for (const [assetId, qty] of assets) {
      const value = sliceValue(assetId, qty);
      if (value.isZero()) continue;
      const groupKey = wallet?.groupId ?? "unknown";
      groupValues.set(groupKey, (groupValues.get(groupKey) ?? new Decimal(0)).plus(value));
      const typeKey = wallet?.storageTypeId ?? "none";
      typeValues.set(typeKey, (typeValues.get(typeKey) ?? new Decimal(0)).plus(value));
    }
  }

  return {
    baseCurrency,
    byAsset,
    byGroup: [...groupValues].map(([key, value]) => ({
      key,
      label: groupRows.find((g) => g.id === key)?.name ?? key,
      value: Number(value.toFixed(2)),
    })),
    byStorageType: [...typeValues].map(([key, value]) => ({
      key,
      label: typeRows.find((t) => t.id === key)?.name ?? "—",
      value: Number(value.toFixed(2)),
    })),
  };
}

/** Per-asset price series with trade markers + that asset's P/L slice. */
export async function getAssetDetail(
  db: DbConn,
  assetId: string,
  days: number | null,
  fetchImpl?: Fetcher,
): Promise<AssetDetailResponse> {
  const { baseCurrency, method, rewardBasis } = readConfig(db);
  const txs = listAllTransactions(db);
  const quoteCurrencies = [
    ...new Set(txs.map((t) => t.priceCurrency).filter((c): c is string => Boolean(c))),
  ];
  const prices = await buildPriceIndex(
    db,
    { assetIds: involvedAssets(txs).concat(assetId), quoteCurrencies, baseCurrency },
    fetchImpl,
  );
  const pl = computePl(txs, { method, rewardBasis, prices });
  const asset = pl.assets.get(assetId);

  const priceOf = loadPriceMap(db, [assetId], baseCurrency);
  const today = Date.parse(utcDay(Date.now()));
  const start = days ? today - days * DAY_MS : today - 365 * DAY_MS;
  const series: { date: string; price: number }[] = [];
  for (let ms = start; ms <= today; ms += DAY_MS) {
    const date = utcDay(ms);
    const price = priceOf(assetId, date);
    if (price) series.push({ date, price: Number(Number(price).toFixed(8)) });
  }

  const spot = await getSpotPrices(db, [assetId], baseCurrency, fetchImpl);
  const spotPrice = spot.prices[assetId];
  const quantity = asset?.quantity ?? "0";

  return {
    assetId,
    baseCurrency,
    series,
    markers: txs
      .filter((tx) => tx.assetId === assetId && (tx.type === "buy" || tx.type === "sell"))
      .map((tx) => ({ date: utcDay(tx.occurredAt), type: tx.type, quantity: tx.quantity })),
    quantity,
    value: spotPrice ? new Decimal(quantity).times(spotPrice).toString() : null,
    costBasis: asset?.costBasis ?? "0",
    realized: asset?.realized ?? "0",
    feesPaid: asset?.feesPaid ?? "0",
    rewardsValue: asset?.rewardsValue ?? "0",
  };
}
