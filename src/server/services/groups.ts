import type { WalletGroupDto } from "@shared/api.ts";
import { asc, eq } from "drizzle-orm";
import type { DbConn } from "../db/index.ts";
import { walletGroups, wallets } from "../db/schema.ts";
import { notFound, ServiceError } from "../lib/errors.ts";
import { getUser } from "./setup.ts";

function toDto(row: typeof walletGroups.$inferSelect): WalletGroupDto {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
  };
}

export function listGroups(db: DbConn): WalletGroupDto[] {
  return db
    .select()
    .from(walletGroups)
    .orderBy(asc(walletGroups.sortOrder), asc(walletGroups.createdAt))
    .all()
    .map(toDto);
}

export function createGroup(db: DbConn, name: string): WalletGroupDto {
  const user = getUser(db);
  if (!user) throw notFound();

  const maxSort = db
    .select()
    .from(walletGroups)
    .all()
    .reduce((max, g) => Math.max(max, g.sortOrder), -1);

  const row = db
    .insert(walletGroups)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name,
      isDefault: false,
      sortOrder: maxSort + 1,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
  return toDto(row);
}

export function updateGroup(
  db: DbConn,
  id: string,
  patch: { name?: string; sortOrder?: number },
): WalletGroupDto {
  const existing = db.select().from(walletGroups).where(eq(walletGroups.id, id)).get();
  if (!existing) throw notFound();

  const row = db.update(walletGroups).set(patch).where(eq(walletGroups.id, id)).returning().get();
  return toDto(row);
}

/** Deleting a group re-homes its wallets to the default group — never deletes them. */
export function deleteGroup(db: DbConn, id: string): void {
  const existing = db.select().from(walletGroups).where(eq(walletGroups.id, id)).get();
  if (!existing) throw notFound();
  if (existing.isDefault) {
    throw new ServiceError(409, "default_group_undeletable", "errors.defaultGroupUndeletable");
  }

  const defaultGroup = db.select().from(walletGroups).where(eq(walletGroups.isDefault, true)).get();
  if (!defaultGroup) throw notFound();

  db.update(wallets).set({ groupId: defaultGroup.id }).where(eq(wallets.groupId, id)).run();
  db.delete(walletGroups).where(eq(walletGroups.id, id)).run();
}
