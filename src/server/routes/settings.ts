import type { SettingsResponse } from "@shared/api.ts";
import { patchSettingsSchema } from "@shared/schemas/settings.ts";
import type { Db } from "../db/index.ts";
import { protectedRoute } from "../lib/guard.ts";
import { readValidated } from "../lib/http.ts";
import { getSetting, setSetting } from "../services/settings.ts";

function currentSettings(db: Db): SettingsResponse {
  return {
    language: getSetting<string>(db, "language") ?? "en",
    baseCurrency: getSetting<string>(db, "baseCurrency") ?? "usd",
    costBasisMethod:
      getSetting<SettingsResponse["costBasisMethod"]>(db, "costBasisMethod") ?? "average",
    stakingRewardCostBasis:
      getSetting<SettingsResponse["stakingRewardCostBasis"]>(db, "stakingRewardCostBasis") ??
      "market",
  };
}

/** User preferences (PLANNING #18) — read and partial update. */
export function createSettingsRoutes(db: Db) {
  return {
    get: protectedRoute(db, () => Response.json(currentSettings(db))),
    update: protectedRoute(db, async (req) => {
      const patch = await readValidated(req, patchSettingsSchema);
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) {
          setSetting(db, key as keyof typeof patch, value);
        }
      }
      return Response.json(currentSettings(db));
    }),
  };
}
