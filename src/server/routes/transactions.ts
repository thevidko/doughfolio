import type { TransactionListResponse } from "@shared/api.ts";
import { runningBalances } from "@shared/balances.ts";
import { createTransactionSchema, patchTransactionSchema } from "@shared/schemas/transactions.ts";
import type { Db } from "../db/index.ts";
import { protectedRoute } from "../lib/guard.ts";
import { readValidated } from "../lib/http.ts";
import {
  createTransaction,
  deleteTransaction,
  listWalletTransactions,
  updateTransaction,
} from "../services/transactions.ts";

/** Transaction CRUD (manual-transactions spec). */
export function createTransactionRoutes(db: Db) {
  return {
    listForWallet: protectedRoute(db, (_req, walletId) => {
      const transactions = listWalletTransactions(db, walletId);
      const body: TransactionListResponse = {
        transactions,
        runningBalances: runningBalances(transactions),
      };
      return Response.json(body);
    }),
    create: protectedRoute(db, async (req) => {
      const body = await readValidated(req, createTransactionSchema);
      return Response.json({ transactions: createTransaction(db, body) }, { status: 201 });
    }),
    update: protectedRoute(db, async (req, id) => {
      const body = await readValidated(req, patchTransactionSchema);
      return Response.json({ transactions: updateTransaction(db, id, body) });
    }),
    remove: protectedRoute(db, (_req, id) => {
      deleteTransaction(db, id);
      return Response.json({ ok: true });
    }),
  };
}
