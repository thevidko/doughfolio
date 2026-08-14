import type { StorageTypeListResponse } from "@shared/api.ts";
import { createStorageTypeSchema, patchStorageTypeSchema } from "@shared/schemas/wallets.ts";
import type { Db } from "../db/index.ts";
import { protectedRoute } from "../lib/guard.ts";
import { readValidated } from "../lib/http.ts";
import {
  createStorageType,
  deleteStorageType,
  listStorageTypes,
  updateStorageType,
} from "../services/storage-types.ts";

/** CRUD for storage-style labels — wallet-structure spec. */
export function createStorageTypeRoutes(db: Db) {
  return {
    list: protectedRoute(db, () =>
      Response.json({
        storageTypes: listStorageTypes(db),
      } satisfies StorageTypeListResponse),
    ),
    create: protectedRoute(db, async (req) => {
      const body = await readValidated(req, createStorageTypeSchema);
      return Response.json({ storageType: createStorageType(db, body.name) }, { status: 201 });
    }),
    update: protectedRoute(db, async (req, id) => {
      const body = await readValidated(req, patchStorageTypeSchema);
      return Response.json({ storageType: updateStorageType(db, id, body) });
    }),
    remove: protectedRoute(db, (_req, id) => {
      deleteStorageType(db, id);
      return Response.json({ ok: true });
    }),
  };
}
