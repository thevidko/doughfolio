import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { openDatabase } from "../db/index.ts";
import { storageTypes, walletGroups, wallets } from "../db/schema.ts";
import { getSetting } from "./settings.ts";
import { completeSetup } from "./setup.ts";
import { ensureWalletDefaults } from "./wallet-defaults.ts";

function freshDb() {
  return openDatabase(mkdtempSync(join(tmpdir(), "doughfolio-test-")));
}

describe("ensureWalletDefaults", () => {
  it("no-ops before setup created the user", () => {
    const db = freshDb();
    ensureWalletDefaults(db);
    expect(db.select().from(walletGroups).all()).toHaveLength(0);
  });

  it("seeds default group, storage types and setting during setup", async () => {
    const db = freshDb();
    await completeSetup(db, {
      language: "cs",
      baseCurrency: "czk",
      wallets: [{ name: "Hodl" }],
    });

    const groups = db.select().from(walletGroups).all();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("Napařovák");
    expect(groups[0]?.isDefault).toBe(true);

    const types = db.select().from(storageTypes).all();
    expect(types.map((t) => t.name).sort()).toEqual(["Cold", "Hot", "Stakováno"]);
    const staked = types.find((t) => t.behavior === "staking");
    expect(staked?.builtin).toBe(true);

    // The setup-created wallet was homed into the default group.
    const wallet = db.select().from(wallets).where(eq(wallets.name, "Hodl")).get();
    expect(wallet?.groupId).toBe(groups[0]?.id ?? "");

    expect(getSetting<string>(db, "stakingRewardCostBasis")).toBe("market");
  });

  it("is idempotent and backfills group-less wallets (v0.2.x upgrade path)", async () => {
    const db = freshDb();
    await completeSetup(db, { language: "en", baseCurrency: "usd", wallets: [] });

    // Simulate a wallet row created before groups existed.
    const user = db.select().from(walletGroups).get();
    db.insert(wallets)
      .values({
        id: crypto.randomUUID(),
        userId: user?.userId ?? "",
        name: "Legacy",
        kind: "manual",
        groupId: null,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
      })
      .run();

    ensureWalletDefaults(db);
    ensureWalletDefaults(db);

    expect(db.select().from(walletGroups).all()).toHaveLength(1);
    const legacy = db.select().from(wallets).where(eq(wallets.name, "Legacy")).get();
    expect(legacy?.groupId).not.toBeNull();
  });
});
