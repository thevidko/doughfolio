import type { SetupCompleteRequest } from "@shared/schemas/setup.ts";
import type { DbConn } from "../db/index.ts";
import { users, wallets } from "../db/schema.ts";
import { createSession } from "./sessions.ts";
import { getSetting, setSetting } from "./settings.ts";
import { ensureWalletDefaults } from "./wallet-defaults.ts";

export function isSetupCompleted(db: DbConn): boolean {
  return getSetting<string>(db, "setupCompletedAt") !== null;
}

/** The single account (PLANNING #4); null before setup completes. */
export function getUser(db: DbConn) {
  return db.select().from(users).get() ?? null;
}

/**
 * Apply all wizard choices atomically: create the account, store preferences,
 * create initial wallets, and open a session when a password was set (so the
 * person completing setup is not locked out).
 */
export async function completeSetup(
  db: DbConn,
  input: SetupCompleteRequest,
): Promise<{ sessionToken: string | null }> {
  const passwordHash = input.password ? await Bun.password.hash(input.password) : null;
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();

  let sessionToken: string | null = null;
  db.transaction((tx) => {
    tx.insert(users)
      .values({
        id: userId,
        displayName: input.displayName ?? null,
        passwordHash,
        createdAt: now,
      })
      .run();

    for (const wallet of input.wallets) {
      tx.insert(wallets)
        .values({
          id: crypto.randomUUID(),
          userId,
          name: wallet.name,
          kind: "manual",
          createdAt: now,
        })
        .run();
    }

    setSetting(tx, "language", input.language);
    setSetting(tx, "baseCurrency", input.baseCurrency);
    setSetting(tx, "setupCompletedAt", now);

    // Seeds the default group/storage types and homes the wallets just created.
    ensureWalletDefaults(tx);

    if (passwordHash) {
      sessionToken = createSession(tx, userId);
    }
  });

  return { sessionToken };
}
