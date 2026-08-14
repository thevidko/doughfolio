import type { Db } from "../db/index.ts";
import type { Fetcher } from "../lib/coingecko.ts";
import { protectedRoute } from "../lib/guard.ts";
import { getSpotPrices } from "../services/prices.ts";

/** `GET /api/prices/spot?assets=a,b&currency=usd` — cached spot prices. */
export function createPriceRoutes(db: Db, fetchImpl?: Fetcher) {
  return {
    spot: protectedRoute(db, async (req) => {
      const params = new URL(req.url).searchParams;
      const assetIds = (params.get("assets") ?? "").split(",").filter(Boolean);
      const currency = (params.get("currency") ?? "usd").toLowerCase();
      return Response.json(await getSpotPrices(db, assetIds, currency, fetchImpl));
    }),
  };
}
