import type { WalletDto } from "@shared/api.ts";
import { asc, eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { storageTypes, transactions, walletGroups, wallets } from "../db/schema.ts";
import { notFound, ServiceError } from "../lib/errors.ts";
import { getUser } from "./setup.ts";

function toDto(row: typeof wallets.$inferSelect): WalletDto {
  if (!row.groupId) {
    // Cannot happen after ensureWalletDefaults ran; guards the DTO contract.
    throw new ServiceError(500, "wallet_without_group", "errors.network");
  }
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    groupId: row.groupId,
    storageTypeId: row.storageTypeId,
    defaultAssetId: row.defaultAssetId,
    sortOrder: row.sortOrder,
  };
}

function assertGroupExists(db: DbConn, groupId: string): void {
  if (!db.select().from(walletGroups).where(eq(walletGroups.id, groupId)).get()) {
    throw notFound();
  }
}

function assertStorageTypeExists(db: DbConn, storageTypeId: string): void {
  if (!db.select().from(storageTypes).where(eq(storageTypes.id, storageTypeId)).get()) {
    throw notFound();
  }
}

export function listWallets(db: DbConn): WalletDto[] {
  return db
    .select()
    .from(wallets)
    .orderBy(asc(wallets.sortOrder), asc(wallets.createdAt))
    .all()
    .map(toDto);
}

export function createWallet(
  db: DbConn,
  input: {
    name: string;
    groupId?: string;
    storageTypeId?: string | null;
    defaultAssetId?: string | null;
  },
): WalletDto {
  const user = getUser(db);
  if (!user) throw notFound();

  let groupId = input.groupId;
  if (groupId) {
    assertGroupExists(db, groupId);
  } else {
    groupId = db.select().from(walletGroups).where(eq(walletGroups.isDefault, true)).get()?.id;
    if (!groupId) throw notFound();
  }
  if (input.storageTypeId) assertStorageTypeExists(db, input.storageTypeId);

  const maxSort = db
    .select()
    .from(wallets)
    .all()
    .reduce((max, w) => Math.max(max, w.sortOrder), -1);

  const row = db
    .insert(wallets)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name: input.name,
      kind: "manual",
      groupId,
      storageTypeId: input.storageTypeId ?? null,
      defaultAssetId: input.defaultAssetId ?? null,
      sortOrder: maxSort + 1,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
  return toDto(row);
}

export function updateWallet(
  db: DbConn,
  id: string,
  patch: {
    name?: string;
    groupId?: string;
    storageTypeId?: string | null;
    defaultAssetId?: string | null;
    sortOrder?: number;
  },
): WalletDto {
  const existing = db.select().from(wallets).where(eq(wallets.id, id)).get();
  if (!existing) throw notFound();
  if (patch.groupId) assertGroupExists(db, patch.groupId);
  if (patch.storageTypeId) assertStorageTypeExists(db, patch.storageTypeId);

  const row = db.update(wallets).set(patch).where(eq(wallets.id, id)).returning().get();
  return toDto(row);
}

/** Wallets with recorded history must never be deleted (wallet-structure spec). */
export function deleteWallet(db: DbConn, id: string): void {
  const existing = db.select().from(wallets).where(eq(wallets.id, id)).get();
  if (!existing) throw notFound();

  const hasTransactions =
    db.select().from(transactions).where(eq(transactions.walletId, id)).limit(1).get() !==
    undefined;
  if (hasTransactions) {
    throw new ServiceError(409, "wallet_has_transactions", "errors.walletHasTransactions");
  }

  db.delete(wallets).where(eq(wallets.id, id)).run();
}
