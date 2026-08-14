import { describe, expect, it } from "bun:test";
import {
  assetTotals,
  type BalanceTransaction,
  overdrawnPairs,
  runningBalances,
  walletAssetBalances,
} from "./balances.ts";

const tx = (partial: Partial<BalanceTransaction>): BalanceTransaction => ({
  walletId: "w1",
  type: "buy",
  assetId: "bitcoin",
  quantity: "1",
  occurredAt: "2026-01-01T00:00:00Z",
  ...partial,
});

describe("walletAssetBalances", () => {
  it("sums inflows and outflows per wallet and asset", () => {
    const balances = walletAssetBalances([
      tx({ quantity: "1.5" }),
      tx({ type: "sell", quantity: "0.5" }),
      tx({ walletId: "w2", assetId: "ethereum", quantity: "10" }),
    ]);
    expect(balances.get("w1")?.get("bitcoin")).toBe("1");
    expect(balances.get("w2")?.get("ethereum")).toBe("10");
  });

  it("keeps 18-decimal precision intact (no float corruption)", () => {
    const balances = walletAssetBalances([
      tx({ quantity: "0.000000000000000001" }),
      tx({ quantity: "0.000000000000000002" }),
    ]);
    expect(balances.get("w1")?.get("bitcoin")).toBe("3e-18");
  });

  it("transfer pairs conserve the total across wallets", () => {
    const log = [
      tx({ quantity: "2" }),
      tx({ type: "transfer_out", quantity: "0.75", occurredAt: "2026-01-02T00:00:00Z" }),
      tx({
        walletId: "w2",
        type: "transfer_in",
        quantity: "0.75",
        occurredAt: "2026-01-02T00:00:00Z",
      }),
    ];
    const balances = walletAssetBalances(log);
    expect(balances.get("w1")?.get("bitcoin")).toBe("1.25");
    expect(balances.get("w2")?.get("bitcoin")).toBe("0.75");
    expect(assetTotals(balances).get("bitcoin")).toBe("2");
  });

  it("network fees leave the paying wallet in the fee asset", () => {
    const balances = walletAssetBalances([
      tx({ quantity: "1" }),
      tx({
        type: "transfer_out",
        quantity: "0.5",
        feeQuantity: "0.0001",
        feeAssetId: "bitcoin",
      }),
      tx({ walletId: "w2", type: "transfer_in", quantity: "0.5" }),
    ]);
    expect(balances.get("w1")?.get("bitcoin")).toBe("0.4999");
  });

  it("fees in a different asset (exchange token) hit that asset's balance", () => {
    const balances = walletAssetBalances([
      tx({ assetId: "binancecoin", quantity: "5" }),
      tx({
        type: "buy",
        assetId: "bitcoin",
        quantity: "1",
        feeQuantity: "0.1",
        feeAssetId: "binancecoin",
      }),
    ]);
    expect(balances.get("w1")?.get("bitcoin")).toBe("1");
    expect(balances.get("w1")?.get("binancecoin")).toBe("4.9");
  });

  it("rewards add to the balance", () => {
    const balances = walletAssetBalances([
      tx({ type: "reward", assetId: "polkadot", quantity: "0.35" }),
    ]);
    expect(balances.get("w1")?.get("polkadot")).toBe("0.35");
  });
});

describe("assetTotals", () => {
  it("restricts to a wallet subset (staked totals use this)", () => {
    const balances = walletAssetBalances([
      tx({ quantity: "1" }),
      tx({ walletId: "staking", type: "transfer_in", assetId: "bitcoin", quantity: "4" }),
    ]);
    expect(assetTotals(balances, new Set(["staking"])).get("bitcoin")).toBe("4");
    expect(assetTotals(balances).get("bitcoin")).toBe("5");
  });
});

describe("runningBalances", () => {
  it("tracks the row's own wallet+asset pair including same-asset fees", () => {
    const rows = [
      tx({ quantity: "2" }),
      tx({ type: "sell", quantity: "0.5" }),
      tx({ type: "transfer_out", quantity: "0.5", feeQuantity: "0.1", feeAssetId: "bitcoin" }),
    ];
    expect(runningBalances(rows)).toEqual(["2", "1.5", "0.9"]);
  });
});

describe("overdrawnPairs", () => {
  it("flags a sell exceeding the balance at that point in time", () => {
    const flagged = overdrawnPairs([
      tx({ quantity: "1", occurredAt: "2026-01-01T00:00:00Z" }),
      tx({ type: "sell", quantity: "2", occurredAt: "2026-01-02T00:00:00Z" }),
    ]);
    expect(flagged.has("w1:bitcoin")).toBe(true);
  });

  it("does not flag when a backdated buy covers the sell", () => {
    const flagged = overdrawnPairs([
      tx({ type: "sell", quantity: "2", occurredAt: "2026-01-05T00:00:00Z" }),
      tx({ quantity: "3", occurredAt: "2026-01-01T00:00:00Z" }),
    ]);
    expect(flagged.size).toBe(0);
  });
});
