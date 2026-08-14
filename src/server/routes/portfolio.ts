import type { Db } from "../db/index.ts";
import { protectedRoute } from "../lib/guard.ts";
import { getBalances } from "../services/balances.ts";

/** `GET /api/portfolio/balances` — derived holdings for the whole portfolio. */
export function createPortfolioRoutes(db: Db) {
  return {
    balances: protectedRoute(db, () => Response.json(getBalances(db))),
  };
}
