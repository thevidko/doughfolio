import type { BalancesResponse } from "@shared/api.ts";
import { assetTotals, overdrawnPairs, walletAssetBalances } from "@shared/balances.ts";
import { eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { storageTypes, wallets } from "../db/schema.ts";
import { listAllTransactions } from "./transactions.ts";

/** Assemble the balances view the UI needs, via the shared pure engine. */
export function getBalances(db: DbConn): BalancesResponse {
  const txs = listAllTransactions(db);
  const balances = walletAssetBalances(txs);

  const stakingWalletIds = new Set(
    db
      .select({ id: wallets.id })
      .from(wallets)
      .innerJoin(storageTypes, eq(wallets.storageTypeId, storageTypes.id))
      .where(eq(storageTypes.behavior, "staking"))
      .all()
      .map((row) => row.id),
  );

  const toRecord = (map: Map<string, string>) => Object.fromEntries(map);
  return {
    wallets: Object.fromEntries(
      [...walletAssetBalances(txs)].map(([walletId, assets]) => [walletId, toRecord(assets)]),
    ),
    totals: toRecord(assetTotals(balances)),
    staked: toRecord(assetTotals(balances, stakingWalletIds)),
    overdrawn: [...overdrawnPairs(txs)],
  };
}
