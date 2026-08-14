/**
 * DoughFolio server entrypoint.
 *
 * Uses Bun's fullstack dev server: the imported HTML file is bundled together
 * with its TSX/CSS imports, served with HMR in development, and API routes are
 * declared alongside it. Run with `bun run dev` (hot reload) or `bun start`.
 */
import index from "../client/index.html";
import { openDatabase } from "./db/index.ts";
import { createAssetRoutes } from "./routes/assets.ts";
import { createEnvStatusRoute } from "./routes/env-status.ts";
import { createGroupRoutes } from "./routes/groups.ts";
import { healthRoute } from "./routes/health.ts";
import { createPortfolioRoutes } from "./routes/portfolio.ts";
import { createPriceRoutes } from "./routes/prices.ts";
import { createSessionRoutes } from "./routes/session.ts";
import { createSettingsRoutes } from "./routes/settings.ts";
import { createSetupRoutes } from "./routes/setup.ts";
import { createStorageTypeRoutes } from "./routes/storage-types.ts";
import { createTransactionRoutes } from "./routes/transactions.ts";
import { createWalletRoutes } from "./routes/wallets.ts";
import { ensureWalletDefaults } from "./services/wallet-defaults.ts";

const isProduction = process.env.NODE_ENV === "production";

// Opens the SQLite database and applies pending migrations before serving.
const db = openDatabase(process.env.DATA_DIR ?? "./data");
// Seeds/repairs the wallet structure (covers upgrades from pre-group versions).
ensureWalletDefaults(db);

const setup = createSetupRoutes(db);
const session = createSessionRoutes(db);
const groups = createGroupRoutes(db);
const wallets = createWalletRoutes(db);
const storageTypes = createStorageTypeRoutes(db);
const txns = createTransactionRoutes(db);
const assets = createAssetRoutes(db);
const prices = createPriceRoutes(db);
const portfolio = createPortfolioRoutes(db);
const settings = createSettingsRoutes(db);

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  development: !isProduction && { hmr: true, console: true },

  routes: {
    // API routes — keep each handler in its own module under `routes/`.
    "/api/health": healthRoute,
    "/api/setup/status": setup.status,
    "/api/setup/complete": { POST: setup.complete },
    "/api/session": { GET: session.get, POST: session.login, DELETE: session.logout },
    "/api/env-status": createEnvStatusRoute(),
    "/api/groups": { GET: (req) => groups.list(req), POST: (req) => groups.create(req) },
    "/api/groups/:id": {
      PATCH: (req) => groups.update(req, req.params.id),
      DELETE: (req) => groups.remove(req, req.params.id),
    },
    "/api/wallets": { GET: (req) => wallets.list(req), POST: (req) => wallets.create(req) },
    "/api/wallets/:id": {
      PATCH: (req) => wallets.update(req, req.params.id),
      DELETE: (req) => wallets.remove(req, req.params.id),
    },
    "/api/storage-types": {
      GET: (req) => storageTypes.list(req),
      POST: (req) => storageTypes.create(req),
    },
    "/api/storage-types/:id": {
      PATCH: (req) => storageTypes.update(req, req.params.id),
      DELETE: (req) => storageTypes.remove(req, req.params.id),
    },
    "/api/wallets/:id/transactions": { GET: (req) => txns.listForWallet(req, req.params.id) },
    "/api/transactions": { POST: (req) => txns.create(req) },
    "/api/transactions/:id": {
      PATCH: (req) => txns.update(req, req.params.id),
      DELETE: (req) => txns.remove(req, req.params.id),
    },
    "/api/assets": { GET: (req) => assets.search(req) },
    "/api/prices/spot": { GET: (req) => prices.spot(req) },
    "/api/portfolio/balances": { GET: (req) => portfolio.balances(req) },
    "/api/portfolio/summary": { GET: (req) => portfolio.summary(req) },
    "/api/portfolio/history": { GET: (req) => portfolio.history(req) },
    "/api/portfolio/allocation": { GET: (req) => portfolio.allocation(req) },
    "/api/portfolio/asset/:assetId": {
      GET: (req) => portfolio.assetDetail(req, req.params.assetId),
    },
    "/api/settings": { GET: (req) => settings.get(req), PATCH: (req) => settings.update(req) },

    // Frontend SPA — catch-all must stay last so API routes take precedence.
    "/*": index,
  },
});

console.info(
  `🥟 DoughFolio is steaming at ${server.url} (${isProduction ? "production" : "development"})`,
);
