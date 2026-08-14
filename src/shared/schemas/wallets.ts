import { z } from "zod";

/** Request bodies of the wallet-structure CRUD API (wallet-structure spec). */

const name = z.string().trim().min(1).max(50);

export const createGroupSchema = z.object({ name });
export const patchGroupSchema = z.object({
  name: name.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createWalletSchema = z.object({
  name,
  groupId: z.string().optional(),
  storageTypeId: z.string().nullable().optional(),
});
export const patchWalletSchema = z.object({
  name: name.optional(),
  groupId: z.string().optional(),
  storageTypeId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createStorageTypeSchema = z.object({ name });
export const patchStorageTypeSchema = z.object({
  name: name.optional(),
  sortOrder: z.number().int().min(0).optional(),
});
