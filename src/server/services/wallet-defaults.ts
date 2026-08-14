import { eq, isNull } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { storageTypes, walletGroups, wallets } from "../db/schema.ts";
import { getSetting, setSetting } from "./settings.ts";
import { getUser } from "./setup.ts";

/**
 * Idempotent seeding of the wallet structure (wallet-structure spec):
 * the default themed group, the built-in storage types, the staking-reward
 * setting, and a group backfill for wallets created before groups existed.
 *
 * Runs on every server start (covers upgrades from v0.2.x) and at the end of
 * setup (covers fresh installs). No-ops before setup creates the user.
 */
export function ensureWalletDefaults(db: DbConn): void {
  const user = getUser(db);
  if (!user) return;

  const now = new Date().toISOString();
  const language = getSetting<string>(db, "language") ?? "en";

  let defaultGroup = db.select().from(walletGroups).where(eq(walletGroups.isDefault, true)).get();
  if (!defaultGroup) {
    defaultGroup = db
      .insert(walletGroups)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        // Themed default name (owner decision); freely renamable afterwards.
        name: language === "cs" ? "Napařovák" : "The Steamer",
        isDefault: true,
        sortOrder: 0,
        createdAt: now,
      })
      .returning()
      .get();
  }

  const hasTypes = db.select().from(storageTypes).limit(1).get() !== undefined;
  if (!hasTypes) {
    const seeded =
      language === "cs"
        ? (["Hot", "Cold", "Stakováno"] as const)
        : (["Hot", "Cold", "Staked"] as const);
    db.insert(storageTypes)
      .values([
        {
          id: crypto.randomUUID(),
          userId: user.id,
          name: seeded[0],
          behavior: "plain",
          builtin: false,
          sortOrder: 0,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          userId: user.id,
          name: seeded[1],
          behavior: "plain",
          builtin: false,
          sortOrder: 1,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          userId: user.id,
          name: seeded[2],
          behavior: "staking",
          builtin: true,
          sortOrder: 2,
          createdAt: now,
        },
      ])
      .run();
  }

  db.update(wallets).set({ groupId: defaultGroup.id }).where(isNull(wallets.groupId)).run();

  if (getSetting(db, "stakingRewardCostBasis") === null) {
    setSetting(db, "stakingRewardCostBasis", "market");
  }
}
