import type { AssetSearchResponse } from "@shared/api.ts";
import type { Db } from "../db/index.ts";
import type { Fetcher } from "../lib/coingecko.ts";
import { protectedRoute } from "../lib/guard.ts";
import { searchAssets } from "../services/assets.ts";

/** `GET /api/assets?query=…` — search the cached CoinGecko catalog. */
export function createAssetRoutes(db: Db, fetchImpl?: Fetcher) {
  return {
    search: protectedRoute(db, async (req) => {
      const query = new URL(req.url).searchParams.get("query") ?? "";
      const assets = await searchAssets(db, query, fetchImpl);
      return Response.json({ assets } satisfies AssetSearchResponse);
    }),
  };
}
