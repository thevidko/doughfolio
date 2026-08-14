import type { Db } from "../db/index.ts";
import type { Fetcher } from "../lib/coingecko.ts";
import { protectedRoute } from "../lib/guard.ts";
import { getBalances } from "../services/balances.ts";
import {
  getAssetDetail,
  getPortfolioAllocation,
  getPortfolioHistory,
  getPortfolioSummary,
} from "../services/portfolio.ts";

function parseDays(req: Request): number | null {
  const raw = new URL(req.url).searchParams.get("days");
  const days = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : null;
}

/** Portfolio views: balances, headline stats, history, allocation, asset detail. */
export function createPortfolioRoutes(db: Db, fetchImpl?: Fetcher) {
  return {
    balances: protectedRoute(db, () => Response.json(getBalances(db))),
    summary: protectedRoute(db, async () =>
      Response.json(await getPortfolioSummary(db, fetchImpl)),
    ),
    history: protectedRoute(db, async (req) =>
      Response.json(await getPortfolioHistory(db, parseDays(req), fetchImpl)),
    ),
    allocation: protectedRoute(db, async () =>
      Response.json(await getPortfolioAllocation(db, fetchImpl)),
    ),
    assetDetail: protectedRoute(db, async (req, assetId) =>
      Response.json(await getAssetDetail(db, assetId, parseDays(req), fetchImpl)),
    ),
  };
}
