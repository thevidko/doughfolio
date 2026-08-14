import { describe, expect, it } from "bun:test";
import { computePl, type PlTransaction, type PriceIndex } from "./pl.ts";

/** Fixture prices: BTC 1,000,000 CZK flat; DOT 100 CZK; EUR→CZK = 25. */
const PRICES: PriceIndex = {
  assetPrice: (assetId) =>
    assetId === "bitcoin" ? "1000000" : assetId === "polkadot" ? "100" : null,
  fxToBase: (currency) => (currency === "czk" ? "1" : currency === "eur" ? "25" : null),
};

const tx = (partial: Partial<PlTransaction>): PlTransaction => ({
  walletId: "w1",
  type: "buy",
  assetId: "bitcoin",
  quantity: "1",
  unitPrice: "1000000",
  priceCurrency: "czk",
  occurredAt: "2026-01-01T00:00:00Z",
  ...partial,
});

const opts = { method: "average" as const, rewardBasis: "market" as const, prices: PRICES };

describe("computePl — average cost", () => {
  it("computes average cost across buys and realized P/L on sells", () => {
    const result = computePl(
      [
        tx({ quantity: "1", unitPrice: "800000" }),
        tx({ quantity: "1", unitPrice: "1200000", occurredAt: "2026-01-02T00:00:00Z" }),
        tx({
          type: "sell",
          quantity: "1",
          unitPrice: "1500000",
          occurredAt: "2026-01-03T00:00:00Z",
        }),
      ],
      opts,
    );
    const btc = result.assets.get("bitcoin");
    // Average cost 1,000,000; sell at 1,500,000 → +500,000 realized.
    expect(btc?.realized).toBe("500000");
    expect(btc?.quantity).toBe("1");
    expect(btc?.costBasis).toBe("1000000");
  });

  it("converts non-base trade currencies via fx", () => {
    const result = computePl(
      [tx({ quantity: "1", unitPrice: "40000", priceCurrency: "eur" })],
      opts,
    );
    expect(result.assets.get("bitcoin")?.costBasis).toBe("1000000");
  });

  it("buy fee increases cost basis; sell fee reduces proceeds", () => {
    const result = computePl(
      [
        tx({
          quantity: "1",
          unitPrice: "1000000",
          feeQuantity: "0.001",
          feeAssetId: "bitcoin",
        }),
        tx({
          type: "sell",
          quantity: "0.5",
          unitPrice: "1000000",
          feeQuantity: "0.001",
          feeAssetId: "bitcoin",
          occurredAt: "2026-01-02T00:00:00Z",
        }),
      ],
      opts,
    );
    const btc = result.assets.get("bitcoin");
    // Buy basis 1,001,000 for 1 BTC (fee 1000 CZK); fee also left the position.
    // Sell 0.5 → proceeds 500,000 − 1,000 fee = 499,000; basis out 0.5×1,001,000.
    expect(btc?.feesPaid).toBe("2000");
    expect(btc?.realized).toBe("-1500");
  });

  it("transfers move funds without realizing; network fee is expensed", () => {
    const result = computePl(
      [
        tx({ quantity: "1" }),
        tx({
          type: "transfer_out",
          quantity: "0.6",
          unitPrice: null,
          priceCurrency: null,
          feeQuantity: "0.0002",
          feeAssetId: "bitcoin",
          occurredAt: "2026-01-02T00:00:00Z",
        }),
        tx({
          walletId: "w2",
          type: "transfer_in",
          quantity: "0.6",
          unitPrice: null,
          priceCurrency: null,
          occurredAt: "2026-01-02T00:00:00Z",
        }),
      ],
      opts,
    );
    const btc = result.assets.get("bitcoin");
    expect(btc?.realized).toBe("0");
    expect(btc?.feesPaid).toBe("200");
    expect(btc?.quantity).toBe("0.9998");
  });

  it("rewards enter at market or zero basis per setting", () => {
    const log = [
      tx({
        type: "reward",
        assetId: "polkadot",
        quantity: "10",
        unitPrice: null,
        priceCurrency: null,
      }),
    ];
    const market = computePl(log, opts);
    expect(market.assets.get("polkadot")?.costBasis).toBe("1000");
    expect(market.assets.get("polkadot")?.rewardsValue).toBe("1000");

    const zero = computePl(log, { ...opts, rewardBasis: "zero" });
    expect(zero.assets.get("polkadot")?.costBasis).toBe("0");
    expect(zero.assets.get("polkadot")?.rewardsValue).toBe("1000");
  });

  it("flags missing prices instead of crashing", () => {
    const result = computePl(
      [
        tx({
          type: "reward",
          assetId: "unknowncoin",
          quantity: "5",
          unitPrice: null,
          priceCurrency: null,
        }),
      ],
      opts,
    );
    expect(result.missingPrices).toContain("unknowncoin@2026-01-01");
    expect(result.assets.get("unknowncoin")?.costBasis).toBe("0");
  });
});

describe("computePl — FIFO", () => {
  const fifo = { ...opts, method: "fifo" as const };

  it("consumes the oldest lots first", () => {
    const result = computePl(
      [
        tx({ quantity: "1", unitPrice: "800000" }),
        tx({ quantity: "1", unitPrice: "1200000", occurredAt: "2026-01-02T00:00:00Z" }),
        tx({
          type: "sell",
          quantity: "1",
          unitPrice: "1500000",
          occurredAt: "2026-01-03T00:00:00Z",
        }),
      ],
      fifo,
    );
    const btc = result.assets.get("bitcoin");
    // FIFO disposes the 800k lot → +700,000 realized; open lot is the 1.2M one.
    expect(btc?.realized).toBe("700000");
    expect(btc?.costBasis).toBe("1200000");
  });

  it("a sell spanning multiple lots splits the basis correctly", () => {
    const result = computePl(
      [
        tx({ quantity: "1", unitPrice: "800000" }),
        tx({ quantity: "1", unitPrice: "1200000", occurredAt: "2026-01-02T00:00:00Z" }),
        tx({
          type: "sell",
          quantity: "1.5",
          unitPrice: "1000000",
          occurredAt: "2026-01-03T00:00:00Z",
        }),
      ],
      fifo,
    );
    const btc = result.assets.get("bitcoin");
    // Basis out = 800,000 + 0.5×1,200,000 = 1,400,000; proceeds 1,500,000.
    expect(btc?.realized).toBe("100000");
    expect(btc?.quantity).toBe("0.5");
    expect(btc?.costBasis).toBe("600000");
  });

  it("lots travel through transfers unchanged (P/L invariant)", () => {
    const withTransfer = computePl(
      [
        tx({ quantity: "2", unitPrice: "800000" }),
        tx({
          type: "transfer_out",
          quantity: "2",
          unitPrice: null,
          priceCurrency: null,
          occurredAt: "2026-01-02T00:00:00Z",
        }),
        tx({
          walletId: "w2",
          type: "transfer_in",
          quantity: "2",
          unitPrice: null,
          priceCurrency: null,
          occurredAt: "2026-01-02T00:00:00Z",
        }),
        tx({
          walletId: "w2",
          type: "sell",
          quantity: "1",
          unitPrice: "1000000",
          occurredAt: "2026-01-03T00:00:00Z",
        }),
      ],
      fifo,
    );
    const withoutTransfer = computePl(
      [
        tx({ quantity: "2", unitPrice: "800000" }),
        tx({
          type: "sell",
          quantity: "1",
          unitPrice: "1000000",
          occurredAt: "2026-01-03T00:00:00Z",
        }),
      ],
      fifo,
    );
    expect(withTransfer.assets.get("bitcoin")?.realized).toBe(
      withoutTransfer.assets.get("bitcoin")?.realized ?? "",
    );
  });

  it("overdrawn sells carry zero basis for the missing part", () => {
    const result = computePl(
      [
        tx({ quantity: "1", unitPrice: "800000" }),
        tx({
          type: "sell",
          quantity: "2",
          unitPrice: "1000000",
          occurredAt: "2026-01-02T00:00:00Z",
        }),
      ],
      fifo,
    );
    const btc = result.assets.get("bitcoin");
    // Proceeds 2,000,000 − basis 800,000; the uncovered 1 BTC has zero basis.
    expect(btc?.realized).toBe("1200000");
    expect(btc?.quantity).toBe("-1");
  });

  it("18-decimal quantities survive the whole pipeline", () => {
    const result = computePl(
      [
        tx({ quantity: "0.000000000000000003", unitPrice: "1000000" }),
        tx({
          type: "sell",
          quantity: "0.000000000000000001",
          unitPrice: "1000000",
          occurredAt: "2026-01-02T00:00:00Z",
        }),
      ],
      fifo,
    );
    expect(result.assets.get("bitcoin")?.quantity).toBe("2e-18");
  });
});
