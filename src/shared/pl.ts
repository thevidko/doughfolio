import type { BalanceTransaction } from "./balances.ts";
import { Decimal } from "./money.ts";

/**
 * Pure P/L engine (portfolio-analytics spec, PLANNING #10). Consumes the raw
 * transaction log and a prefetched price index; performs no I/O. Both cost
 * basis methods share this implementation; FIFO tracks lots per asset across
 * wallets, so transfers move funds without realizing P/L.
 *
 * Fee treatment (manual-transactions spec): buy fees increase cost basis,
 * sell fees reduce proceeds, transfer/reward fees are expensed — all valued
 * at the fee asset's market price on the transaction day.
 */

export type PlMethod = "average" | "fifo";
export type RewardBasis = "market" | "zero";

export type PlTransaction = BalanceTransaction & {
  unitPrice?: string | null;
  priceCurrency?: string | null;
};

/** Price data prefetched by the caller; dates are YYYY-MM-DD (UTC). */
export type PriceIndex = {
  /** Asset's daily price in the base currency; null = unknown. */
  assetPrice(assetId: string, date: string): string | null;
  /** Conversion rate quote-currency → base currency; null = unknown. */
  fxToBase(currency: string, date: string): string | null;
};

export type AssetPl = {
  assetId: string;
  /** Open quantity across all wallets. */
  quantity: string;
  /** Cost basis of the open quantity, in the base currency. */
  costBasis: string;
  /** Realized P/L from disposals, in the base currency. */
  realized: string;
  /** All fees attributed to this asset's transactions, valued in base. */
  feesPaid: string;
  /** Market value of staking rewards at receipt (informational). */
  rewardsValue: string;
};

export type PlResult = {
  assets: Map<string, AssetPl>;
  totals: { costBasis: string; realized: string; feesPaid: string; rewardsValue: string };
  /** "assetId@date" pairs where a needed price was missing (valued as 0). */
  missingPrices: string[];
};

type Lot = { qty: Decimal; unitCost: Decimal };

type AssetState = {
  lots: Lot[]; // FIFO queue; average method keeps a single virtual lot
  realized: Decimal;
  feesPaid: Decimal;
  rewardsValue: Decimal;
};

const ZERO = new Decimal(0);
const day = (iso: string) => iso.slice(0, 10);

export function computePl(
  txs: readonly PlTransaction[],
  opts: { method: PlMethod; rewardBasis: RewardBasis; prices: PriceIndex },
): PlResult {
  const { method, rewardBasis, prices } = opts;
  const states = new Map<string, AssetState>();
  const missing = new Set<string>();

  const state = (assetId: string): AssetState => {
    let s = states.get(assetId);
    if (!s) {
      s = { lots: [], realized: ZERO, feesPaid: ZERO, rewardsValue: ZERO };
      states.set(assetId, s);
    }
    return s;
  };

  const marketValue = (assetId: string, qty: Decimal, date: string): Decimal => {
    const price = prices.assetPrice(assetId, date);
    if (price === null) {
      missing.add(`${assetId}@${date}`);
      return ZERO;
    }
    return qty.times(price);
  };

  const addLot = (s: AssetState, qty: Decimal, cost: Decimal) => {
    if (method === "average" && s.lots.length === 1) {
      const lot = s.lots[0] as Lot;
      const newQty = lot.qty.plus(qty);
      const newCost = lot.qty.times(lot.unitCost).plus(cost);
      lot.qty = newQty;
      lot.unitCost = newQty.isZero() || newQty.isNegative() ? ZERO : newCost.div(newQty);
      return;
    }
    s.lots.push({ qty, unitCost: qty.isZero() ? ZERO : cost.div(qty) });
    if (method === "average" && s.lots.length > 1) {
      // Collapse into one virtual lot at the running average.
      const totalQty = s.lots.reduce((acc, l) => acc.plus(l.qty), ZERO);
      const totalCost = s.lots.reduce((acc, l) => acc.plus(l.qty.times(l.unitCost)), ZERO);
      s.lots = [
        {
          qty: totalQty,
          unitCost: totalQty.isZero() || totalQty.isNegative() ? ZERO : totalCost.div(totalQty),
        },
      ];
    }
  };

  /** Remove quantity from the front of the queue; returns the basis removed. */
  const consume = (s: AssetState, qty: Decimal): Decimal => {
    let remaining = qty;
    let basis = ZERO;
    while (remaining.gt(0) && s.lots.length > 0) {
      const lot = s.lots[0] as Lot;
      if (lot.qty.lte(remaining)) {
        basis = basis.plus(lot.qty.times(lot.unitCost));
        remaining = remaining.minus(lot.qty);
        s.lots.shift();
      } else {
        basis = basis.plus(remaining.times(lot.unitCost));
        lot.qty = lot.qty.minus(remaining);
        remaining = ZERO;
      }
    }
    // Overdraw beyond recorded lots carries zero basis (warned elsewhere).
    if (remaining.gt(0)) {
      s.lots.unshift({ qty: remaining.negated(), unitCost: ZERO });
    }
    return basis;
  };

  /** Market value of a transaction's fee (0 when it has none). */
  const feeValueOf = (tx: PlTransaction): Decimal => {
    if (!tx.feeQuantity || !tx.feeAssetId) return ZERO;
    return marketValue(tx.feeAssetId, new Decimal(tx.feeQuantity), day(tx.occurredAt));
  };

  /**
   * Remove the fee quantity from the fee asset's position (no realized P/L).
   * Runs AFTER the main lot mutation so a fee paid in the traded asset
   * consumes from the just-updated position instead of creating phantom lots.
   */
  const consumeFeeQty = (tx: PlTransaction): void => {
    if (!tx.feeQuantity || !tx.feeAssetId) return;
    consume(state(tx.feeAssetId), new Decimal(tx.feeQuantity));
  };

  const ordered = [...txs].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  for (const tx of ordered) {
    const s = state(tx.assetId);
    const qty = new Decimal(tx.quantity);
    const date = day(tx.occurredAt);

    switch (tx.type) {
      case "buy": {
        const fx = tx.priceCurrency ? prices.fxToBase(tx.priceCurrency, date) : null;
        if (tx.priceCurrency && fx === null) missing.add(`fx:${tx.priceCurrency}@${date}`);
        const gross =
          tx.unitPrice && fx
            ? qty.times(tx.unitPrice).times(fx)
            : marketValue(tx.assetId, qty, date);
        const feeValue = feeValueOf(tx);
        s.feesPaid = s.feesPaid.plus(feeValue);
        addLot(s, qty, gross.plus(feeValue));
        consumeFeeQty(tx);
        break;
      }
      case "sell": {
        const fx = tx.priceCurrency ? prices.fxToBase(tx.priceCurrency, date) : null;
        if (tx.priceCurrency && fx === null) missing.add(`fx:${tx.priceCurrency}@${date}`);
        const gross =
          tx.unitPrice && fx
            ? qty.times(tx.unitPrice).times(fx)
            : marketValue(tx.assetId, qty, date);
        const feeValue = feeValueOf(tx);
        s.feesPaid = s.feesPaid.plus(feeValue);
        const basis = consume(s, qty);
        s.realized = s.realized.plus(gross.minus(feeValue).minus(basis));
        consumeFeeQty(tx);
        break;
      }
      case "transfer_out": {
        // Lots stay in the per-asset queue — only the network fee is expensed.
        const feeValue = feeValueOf(tx);
        s.feesPaid = s.feesPaid.plus(feeValue);
        consumeFeeQty(tx);
        break;
      }
      case "transfer_in":
        break;
      case "reward": {
        const value = marketValue(tx.assetId, qty, date);
        const feeValue = feeValueOf(tx);
        s.feesPaid = s.feesPaid.plus(feeValue);
        s.rewardsValue = s.rewardsValue.plus(value);
        addLot(s, qty, rewardBasis === "market" ? value : ZERO);
        consumeFeeQty(tx);
        break;
      }
    }
  }

  const assets = new Map<string, AssetPl>();
  const totals = { costBasis: ZERO, realized: ZERO, feesPaid: ZERO, rewardsValue: ZERO };
  for (const [assetId, s] of states) {
    const quantity = s.lots.reduce((acc, l) => acc.plus(l.qty), ZERO);
    const costBasis = s.lots.reduce((acc, l) => acc.plus(l.qty.times(l.unitCost)), ZERO);
    assets.set(assetId, {
      assetId,
      quantity: quantity.toString(),
      costBasis: costBasis.toString(),
      realized: s.realized.toString(),
      feesPaid: s.feesPaid.toString(),
      rewardsValue: s.rewardsValue.toString(),
    });
    totals.costBasis = totals.costBasis.plus(costBasis);
    totals.realized = totals.realized.plus(s.realized);
    totals.feesPaid = totals.feesPaid.plus(s.feesPaid);
    totals.rewardsValue = totals.rewardsValue.plus(s.rewardsValue);
  }

  return {
    assets,
    totals: {
      costBasis: totals.costBasis.toString(),
      realized: totals.realized.toString(),
      feesPaid: totals.feesPaid.toString(),
      rewardsValue: totals.rewardsValue.toString(),
    },
    missingPrices: [...missing],
  };
}
