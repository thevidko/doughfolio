import type { StorageTypeDto } from "@shared/api.ts";
import { asc, eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { storageTypes, wallets } from "../db/schema.ts";
import { notFound, ServiceError } from "../lib/errors.ts";
import { getUser } from "./setup.ts";

function toDto(row: typeof storageTypes.$inferSelect): StorageTypeDto {
  return {
    id: row.id,
    name: row.name,
    behavior: row.behavior,
    builtin: row.builtin,
    sortOrder: row.sortOrder,
  };
}

export function listStorageTypes(db: DbConn): StorageTypeDto[] {
  return db
    .select()
    .from(storageTypes)
    .orderBy(asc(storageTypes.sortOrder), asc(storageTypes.createdAt))
    .all()
    .map(toDto);
}

/** User-created types always have plain behavior; staking stays built-in only. */
export function createStorageType(db: DbConn, name: string): StorageTypeDto {
  const user = getUser(db);
  if (!user) throw notFound();

  const maxSort = db
    .select()
    .from(storageTypes)
    .all()
    .reduce((max, t) => Math.max(max, t.sortOrder), -1);

  const row = db
    .insert(storageTypes)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name,
      behavior: "plain",
      builtin: false,
      sortOrder: maxSort + 1,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
  return toDto(row);
}

export function updateStorageType(
  db: DbConn,
  id: string,
  patch: { name?: string; sortOrder?: number },
): StorageTypeDto {
  const existing = db.select().from(storageTypes).where(eq(storageTypes.id, id)).get();
  if (!existing) throw notFound();

  const row = db.update(storageTypes).set(patch).where(eq(storageTypes.id, id)).returning().get();
  return toDto(row);
}

/** Deleting a type clears it from wallets; built-in types refuse deletion. */
export function deleteStorageType(db: DbConn, id: string): void {
  const existing = db.select().from(storageTypes).where(eq(storageTypes.id, id)).get();
  if (!existing) throw notFound();
  if (existing.builtin) {
    throw new ServiceError(
      409,
      "builtin_storage_type_undeletable",
      "errors.builtinStorageTypeUndeletable",
    );
  }

  db.update(wallets).set({ storageTypeId: null }).where(eq(wallets.storageTypeId, id)).run();
  db.delete(storageTypes).where(eq(storageTypes.id, id)).run();
}
