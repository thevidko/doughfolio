import type { TransactionDto } from "@shared/api.ts";
import type {
  CreateTransactionRequest,
  PatchTransactionRequest,
} from "@shared/schemas/transactions.ts";
import { asc, eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { transactions, wallets } from "../db/schema.ts";
import { notFound, ServiceError } from "../lib/errors.ts";
import { getUser } from "./setup.ts";

function toDto(row: typeof transactions.$inferSelect): TransactionDto {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type,
    assetId: row.assetId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    priceCurrency: row.priceCurrency,
    feeQuantity: row.feeQuantity,
    feeAssetId: row.feeAssetId,
    transferGroupId: row.transferGroupId,
    occurredAt: row.occurredAt,
    note: row.note,
  };
}

function assertWalletExists(db: DbConn, walletId: string): void {
  if (!db.select().from(wallets).where(eq(wallets.id, walletId)).get()) {
    throw notFound();
  }
}

export function listWalletTransactions(db: DbConn, walletId: string): TransactionDto[] {
  assertWalletExists(db, walletId);
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.walletId, walletId))
    .orderBy(asc(transactions.occurredAt), asc(transactions.createdAt))
    .all()
    .map(toDto);
}

export function listAllTransactions(db: DbConn): TransactionDto[] {
  return db
    .select()
    .from(transactions)
    .orderBy(asc(transactions.occurredAt), asc(transactions.createdAt))
    .all()
    .map(toDto);
}

/** Create one transaction; a `transfer` becomes two rows linked atomically. */
export function createTransaction(db: DbConn, input: CreateTransactionRequest): TransactionDto[] {
  const user = getUser(db);
  if (!user) throw notFound();
  const createdAt = new Date().toISOString();

  const base = {
    userId: user.id,
    assetId: input.assetId,
    quantity: input.quantity,
    feeQuantity: input.fee?.quantity ?? null,
    feeAssetId: input.fee?.assetId ?? null,
    occurredAt: input.occurredAt,
    note: input.note ?? null,
    createdAt,
    unitPrice: null as string | null,
    priceCurrency: null as string | null,
  };

  if (input.type === "transfer") {
    if (input.fromWalletId === input.toWalletId) {
      throw new ServiceError(400, "transfer_same_wallet", "errors.transferSameWallet");
    }
    assertWalletExists(db, input.fromWalletId);
    assertWalletExists(db, input.toWalletId);
    const transferGroupId = crypto.randomUUID();

    const rows = db.transaction((tx) => [
      tx
        .insert(transactions)
        // The network fee lives on the outgoing row (manual-transactions spec).
        .values({
          ...base,
          id: crypto.randomUUID(),
          walletId: input.fromWalletId,
          type: "transfer_out",
          transferGroupId,
        })
        .returning()
        .get(),
      tx
        .insert(transactions)
        .values({
          ...base,
          id: crypto.randomUUID(),
          walletId: input.toWalletId,
          type: "transfer_in",
          transferGroupId,
          feeQuantity: null,
          feeAssetId: null,
        })
        .returning()
        .get(),
    ]);
    return rows.map(toDto);
  }

  assertWalletExists(db, input.walletId);
  const row = db
    .insert(transactions)
    .values({
      ...base,
      id: crypto.randomUUID(),
      walletId: input.walletId,
      type: input.type,
      transferGroupId: null,
      unitPrice: input.type === "reward" ? null : input.unitPrice,
      priceCurrency: input.type === "reward" ? null : input.priceCurrency,
    })
    .returning()
    .get();
  return [toDto(row)];
}

/** Edit a transaction; both rows of a transfer stay consistent (atomic). */
export function updateTransaction(
  db: DbConn,
  id: string,
  patch: PatchTransactionRequest,
): TransactionDto[] {
  const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!row) throw notFound();

  for (const walletId of [patch.walletId, patch.fromWalletId, patch.toWalletId]) {
    if (walletId) assertWalletExists(db, walletId);
  }

  const shared = {
    ...(patch.assetId !== undefined && { assetId: patch.assetId }),
    ...(patch.quantity !== undefined && { quantity: patch.quantity }),
    ...(patch.occurredAt !== undefined && { occurredAt: patch.occurredAt }),
    ...(patch.note !== undefined && { note: patch.note }),
  };
  const feePatch =
    patch.fee === undefined
      ? {}
      : { feeQuantity: patch.fee?.quantity ?? null, feeAssetId: patch.fee?.assetId ?? null };

  if (row.transferGroupId) {
    const groupId = row.transferGroupId;
    return db.transaction((tx) => {
      const pair = tx
        .select()
        .from(transactions)
        .where(eq(transactions.transferGroupId, groupId))
        .all();
      for (const item of pair) {
        const walletPatch =
          item.type === "transfer_out"
            ? patch.fromWalletId && { walletId: patch.fromWalletId }
            : patch.toWalletId && { walletId: patch.toWalletId };
        tx.update(transactions)
          .set({
            ...shared,
            ...(item.type === "transfer_out" ? feePatch : {}),
            ...(walletPatch || {}),
          })
          .where(eq(transactions.id, item.id))
          .run();
      }
      return tx
        .select()
        .from(transactions)
        .where(eq(transactions.transferGroupId, groupId))
        .all()
        .map(toDto);
    });
  }

  const updated = db
    .update(transactions)
    .set({
      ...shared,
      ...feePatch,
      ...(patch.walletId && { walletId: patch.walletId }),
      ...(patch.unitPrice !== undefined && { unitPrice: patch.unitPrice }),
      ...(patch.priceCurrency !== undefined && { priceCurrency: patch.priceCurrency }),
    })
    .where(eq(transactions.id, id))
    .returning()
    .get();
  return [toDto(updated)];
}

/** Delete a transaction; a transfer removes both rows. */
export function deleteTransaction(db: DbConn, id: string): void {
  const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!row) throw notFound();

  if (row.transferGroupId) {
    db.delete(transactions).where(eq(transactions.transferGroupId, row.transferGroupId)).run();
  } else {
    db.delete(transactions).where(eq(transactions.id, id)).run();
  }
}
