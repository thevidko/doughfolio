import type { WalletGroupListResponse } from "@shared/api.ts";
import { createGroupSchema, patchGroupSchema } from "@shared/schemas/wallets.ts";
import type { Db } from "../db/index.ts";
import { protectedRoute } from "../lib/guard.ts";
import { readValidated } from "../lib/http.ts";
import { createGroup, deleteGroup, listGroups, updateGroup } from "../services/groups.ts";

/** CRUD for wallet groups ("steamers") — wallet-structure spec. */
export function createGroupRoutes(db: Db) {
  return {
    list: protectedRoute(db, () =>
      Response.json({ groups: listGroups(db) } satisfies WalletGroupListResponse),
    ),
    create: protectedRoute(db, async (req) => {
      const body = await readValidated(req, createGroupSchema);
      return Response.json({ group: createGroup(db, body.name) }, { status: 201 });
    }),
    update: protectedRoute(db, async (req, id) => {
      const body = await readValidated(req, patchGroupSchema);
      return Response.json({ group: updateGroup(db, id, body) });
    }),
    remove: protectedRoute(db, (_req, id) => {
      deleteGroup(db, id);
      return Response.json({ ok: true });
    }),
  };
}
