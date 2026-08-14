import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/index.ts";
import { transactions } from "../db/schema.ts";
import { completeSetup, getUser } from "../services/setup.ts";
import { createGroupRoutes } from "./groups.ts";
import { createStorageTypeRoutes } from "./storage-types.ts";
import { createWalletRoutes } from "./wallets.ts";

/** Configured instance without password (auth gate passes automatically). */
async function instance(withPassword = false) {
  const db = openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
  await completeSetup(db, {
    language: "en",
    baseCurrency: "usd",
    password: withPassword ? "steamed-buns" : undefined,
    wallets: [{ name: "First" }],
  });
  return {
    db,
    groups: createGroupRoutes(db),
    wallets: createWalletRoutes(db),
    storageTypes: createStorageTypeRoutes(db),
  };
}

const jsonReq = (body: unknown, method = "POST") =>
  new Request("http://localhost/", { method, body: JSON.stringify(body) });
const bareReq = (method = "GET") => new Request("http://localhost/", { method });

describe("auth gate", () => {
  it("rejects data routes without a session on protected instances", async () => {
    const { groups } = await instance(true);
    const res = await groups.list(bareReq());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("passes on unprotected instances", async () => {
    const { groups } = await instance();
    expect((await groups.list(bareReq())).status).toBe(200);
  });
});

describe("/api/groups", () => {
  it("lists the default group and creates new ones", async () => {
    const { groups } = await instance();
    const created = await groups.create(jsonReq({ name: "Trading" }));
    expect(created.status).toBe(201);

    const body = await (await groups.list(bareReq())).json();
    expect(body.groups.map((g: { name: string }) => g.name)).toEqual(["The Steamer", "Trading"]);
    expect(body.groups[0].isDefault).toBe(true);
  });

  it("renames and reorders", async () => {
    const { groups } = await instance();
    const { group } = await (await groups.create(jsonReq({ name: "Old" }))).json();
    const res = await groups.update(jsonReq({ name: "New", sortOrder: 5 }, "PATCH"), group.id);
    const body = await res.json();
    expect(body.group.name).toBe("New");
    expect(body.group.sortOrder).toBe(5);
  });

  it("refuses to delete the default group", async () => {
    const { groups } = await instance();
    const list = await (await groups.list(bareReq())).json();
    const res = await groups.remove(bareReq("DELETE"), list.groups[0].id);
    expect(res.status).toBe(409);
    expect((await res.json()).error.messageKey).toBe("errors.defaultGroupUndeletable");
  });

  it("deleting a group moves its wallets to the default group", async () => {
    const { groups, wallets } = await instance();
    const { group } = await (await groups.create(jsonReq({ name: "Temp" }))).json();
    const { wallet } = await (
      await wallets.create(jsonReq({ name: "Basket", groupId: group.id }))
    ).json();

    await groups.remove(bareReq("DELETE"), group.id);

    const list = await (await wallets.list(bareReq())).json();
    const moved = list.wallets.find((w: { id: string }) => w.id === wallet.id);
    const defaultGroup = (await (await groups.list(bareReq())).json()).groups[0];
    expect(moved.groupId).toBe(defaultGroup.id);
  });
});

describe("/api/wallets", () => {
  it("creates into the default group when none given, with storage type", async () => {
    const { wallets, storageTypes } = await instance();
    const types = (await (await storageTypes.list(bareReq())).json()).storageTypes;
    const cold = types.find((t: { name: string }) => t.name === "Cold");

    const res = await wallets.create(jsonReq({ name: "Vault", storageTypeId: cold.id }));
    expect(res.status).toBe(201);
    const { wallet } = await res.json();
    expect(wallet.storageTypeId).toBe(cold.id);
    expect(wallet.groupId).toBeTruthy();
  });

  it("404s on unknown group or storage type", async () => {
    const { wallets } = await instance();
    expect((await wallets.create(jsonReq({ name: "X", groupId: "nope" }))).status).toBe(404);
    expect(
      (await wallets.update(jsonReq({ storageTypeId: "nope" }, "PATCH"), "missing")).status,
    ).toBe(404);
  });

  it("deletes an empty wallet but refuses one with transactions", async () => {
    const { db, wallets } = await instance();
    const list = (await (await wallets.list(bareReq())).json()).wallets;
    const target = list[0];

    db.insert(transactions)
      .values({
        id: crypto.randomUUID(),
        userId: getUser(db)?.id ?? "",
        walletId: target.id,
        type: "buy",
        assetId: "bitcoin",
        quantity: "0.5",
        unitPrice: "50000",
        priceCurrency: "usd",
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .run();

    const refused = await wallets.remove(bareReq("DELETE"), target.id);
    expect(refused.status).toBe(409);
    expect((await refused.json()).error.messageKey).toBe("errors.walletHasTransactions");

    const { wallet: empty } = await (await wallets.create(jsonReq({ name: "Empty" }))).json();
    expect((await wallets.remove(bareReq("DELETE"), empty.id)).status).toBe(200);
  });
});

describe("/api/storage-types", () => {
  it("seeds hot/cold/staked and supports user CRUD", async () => {
    const { storageTypes } = await instance();
    const initial = (await (await storageTypes.list(bareReq())).json()).storageTypes;
    expect(initial.map((t: { name: string }) => t.name)).toEqual(["Hot", "Cold", "Staked"]);

    const created = await storageTypes.create(jsonReq({ name: "Hardware" }));
    expect(created.status).toBe(201);
    expect((await created.json()).storageType.behavior).toBe("plain");
  });

  it("staked is renamable but not deletable", async () => {
    const { storageTypes } = await instance();
    const staked = (await (await storageTypes.list(bareReq())).json()).storageTypes.find(
      (t: { behavior: string }) => t.behavior === "staking",
    );

    const renamed = await storageTypes.update(jsonReq({ name: "V peci" }, "PATCH"), staked.id);
    expect((await renamed.json()).storageType.name).toBe("V peci");

    const removed = await storageTypes.remove(bareReq("DELETE"), staked.id);
    expect(removed.status).toBe(409);
    expect((await removed.json()).error.messageKey).toBe("errors.builtinStorageTypeUndeletable");
  });

  it("deleting a user type clears it from wallets", async () => {
    const { storageTypes, wallets } = await instance();
    const { storageType } = await (await storageTypes.create(jsonReq({ name: "Paper" }))).json();
    const { wallet } = await (
      await wallets.create(jsonReq({ name: "Paper wallet", storageTypeId: storageType.id }))
    ).json();

    await storageTypes.remove(bareReq("DELETE"), storageType.id);

    const list = (await (await wallets.list(bareReq())).json()).wallets;
    expect(list.find((w: { id: string }) => w.id === wallet.id).storageTypeId).toBeNull();
  });
});
