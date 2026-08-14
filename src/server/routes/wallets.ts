import type { WalletListResponse } from "@shared/api.ts";
import { createWalletSchema, patchWalletSchema } from "@shared/schemas/wallets.ts";
import type { Db } from "../db/index.ts";
import { protectedRoute } from "../lib/guard.ts";
import { readValidated } from "../lib/http.ts";
import { createWallet, deleteWallet, listWallets, updateWallet } from "../services/wallets.ts";

/** CRUD for wallets ("baskets") — wallet-structure spec. */
export function createWalletRoutes(db: Db) {
  return {
    list: protectedRoute(db, () =>
      Response.json({ wallets: listWallets(db) } satisfies WalletListResponse),
    ),
    create: protectedRoute(db, async (req) => {
      const body = await readValidated(req, createWalletSchema);
      return Response.json({ wallet: createWallet(db, body) }, { status: 201 });
    }),
    update: protectedRoute(db, async (req, id) => {
      const body = await readValidated(req, patchWalletSchema);
      return Response.json({ wallet: updateWallet(db, id, body) });
    }),
    remove: protectedRoute(db, (_req, id) => {
      deleteWallet(db, id);
      return Response.json({ ok: true });
    }),
  };
}
