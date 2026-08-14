import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/index.ts";
import { getBalances } from "../services/balances.ts";
import { completeSetup } from "../services/setup.ts";
import { listWallets } from "../services/wallets.ts";
import { createTransactionRoutes } from "./transactions.ts";

async function instance() {
  const db = openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
  await completeSetup(db, {
    language: "en",
    baseCurrency: "usd",
    wallets: [{ name: "Hot" }, { name: "Cold" }],
  });
  const [hot, cold] = listWallets(db);
  if (!hot || !cold) throw new Error("setup wallets missing");
  return { db, routes: createTransactionRoutes(db), hot, cold };
}

const jsonReq = (body: unknown, method = "POST") =>
  new Request("http://localhost/", { method, body: JSON.stringify(body) });
const bareReq = (method = "GET") => new Request("http://localhost/", { method });

describe("POST /api/transactions", () => {
  it("records a buy and lists it with a running balance", async () => {
    const { routes, hot } = await instance();
    const res = await routes.create(
      jsonReq({
        type: "buy",
        walletId: hot.id,
        assetId: "bitcoin",
        quantity: "0.5",
        unitPrice: "50000",
        priceCurrency: "usd",
        occurredAt: "2026-01-01T10:00:00Z",
      }),
    );
    expect(res.status).toBe(201);

    const list = await (await routes.listForWallet(bareReq(), hot.id)).json();
    expect(list.transactions).toHaveLength(1);
    expect(list.transactions[0].quantity).toBe("0.5");
    expect(list.runningBalances).toEqual(["0.5"]);
  });

  it("a transfer creates two linked rows and conserves totals", async () => {
    const { routes, hot, cold, db } = await instance();
    await routes.create(
      jsonReq({
        type: "buy",
        walletId: hot.id,
        assetId: "bitcoin",
        quantity: "1",
        unitPrice: "50000",
        priceCurrency: "usd",
        occurredAt: "2026-01-01T10:00:00Z",
      }),
    );
    const res = await routes.create(
      jsonReq({
        type: "transfer",
        fromWalletId: hot.id,
        toWalletId: cold.id,
        assetId: "bitcoin",
        quantity: "0.6",
        fee: { quantity: "0.0002", assetId: "bitcoin" },
        occurredAt: "2026-01-02T10:00:00Z",
      }),
    );
    const { transactions: pair } = await res.json();
    expect(pair).toHaveLength(2);
    expect(pair[0].transferGroupId).toBe(pair[1].transferGroupId);

    const balances = getBalances(db);
    expect(balances.wallets[hot.id]?.bitcoin).toBe("0.3998");
    expect(balances.wallets[cold.id]?.bitcoin).toBe("0.6");
    expect(balances.totals.bitcoin).toBe("0.9998");
  });

  it("rejects a transfer within one wallet and invalid decimals", async () => {
    const { routes, hot } = await instance();
    const sameWallet = await routes.create(
      jsonReq({
        type: "transfer",
        fromWalletId: hot.id,
        toWalletId: hot.id,
        assetId: "bitcoin",
        quantity: "1",
        occurredAt: "2026-01-01T10:00:00Z",
      }),
    );
    expect(sameWallet.status).toBe(400);

    const badDecimal = await routes.create(
      jsonReq({
        type: "buy",
        walletId: hot.id,
        assetId: "bitcoin",
        quantity: "1,5",
        unitPrice: "50000",
        priceCurrency: "usd",
        occurredAt: "2026-01-01T10:00:00Z",
      }),
    );
    expect(badDecimal.status).toBe(400);
  });

  it("staked totals come from staking-behavior wallets; rewards accrue there", async () => {
    const { routes, db } = await instance();
    // Make a staking wallet: assign the built-in staked storage type.
    const { storageTypes: types } = await import("../db/schema.ts");
    const { eq } = await import("drizzle-orm");
    const staked = db.select().from(types).where(eq(types.behavior, "staking")).get();
    const { updateWallet, listWallets: list } = await import("../services/wallets.ts");
    const wallet = list(db)[0];
    if (!wallet || !staked) throw new Error("missing fixtures");
    updateWallet(db, wallet.id, { storageTypeId: staked.id });

    await routes.create(
      jsonReq({
        type: "reward",
        walletId: wallet.id,
        assetId: "polkadot",
        quantity: "1.25",
        occurredAt: "2026-01-03T10:00:00Z",
      }),
    );

    const balances = getBalances(db);
    expect(balances.staked.polkadot).toBe("1.25");
  });
});

describe("PATCH & DELETE /api/transactions/:id", () => {
  it("edits both rows of a transfer atomically", async () => {
    const { routes, hot, cold } = await instance();
    const { transactions: pair } = await (
      await routes.create(
        jsonReq({
          type: "transfer",
          fromWalletId: hot.id,
          toWalletId: cold.id,
          assetId: "bitcoin",
          quantity: "0.4",
          occurredAt: "2026-01-02T10:00:00Z",
        }),
      )
    ).json();

    const res = await routes.update(
      jsonReq({ quantity: "0.7", note: "moved more" }, "PATCH"),
      pair[0].id,
    );
    const { transactions: updated } = await res.json();
    expect(updated).toHaveLength(2);
    for (const row of updated) {
      expect(row.quantity).toBe("0.7");
      expect(row.note).toBe("moved more");
    }
  });

  it("deleting one side of a transfer removes both rows", async () => {
    const { routes, hot, cold } = await instance();
    const { transactions: pair } = await (
      await routes.create(
        jsonReq({
          type: "transfer",
          fromWalletId: hot.id,
          toWalletId: cold.id,
          assetId: "bitcoin",
          quantity: "0.4",
          occurredAt: "2026-01-02T10:00:00Z",
        }),
      )
    ).json();

    await routes.remove(bareReq("DELETE"), pair[1].id);
    const hotList = await (await routes.listForWallet(bareReq(), hot.id)).json();
    const coldList = await (await routes.listForWallet(bareReq(), cold.id)).json();
    expect(hotList.transactions).toHaveLength(0);
    expect(coldList.transactions).toHaveLength(0);
  });

  it("overdraw is reported as a warning pair, not an error", async () => {
    const { routes, hot, db } = await instance();
    const res = await routes.create(
      jsonReq({
        type: "sell",
        walletId: hot.id,
        assetId: "bitcoin",
        quantity: "2",
        unitPrice: "60000",
        priceCurrency: "usd",
        occurredAt: "2026-01-01T10:00:00Z",
      }),
    );
    expect(res.status).toBe(201);
    expect(getBalances(db).overdrawn).toContain(`${hot.id}:bitcoin`);
  });
});
