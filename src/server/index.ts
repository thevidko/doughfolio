/**
 * DoughFolio server entrypoint.
 *
 * Uses Bun's fullstack dev server: the imported HTML file is bundled together
 * with its TSX/CSS imports, served with HMR in development, and API routes are
 * declared alongside it. Run with `bun run dev` (hot reload) or `bun start`.
 */
import index from "../client/index.html";
import { openDatabase } from "./db/index.ts";
import { createEnvStatusRoute } from "./routes/env-status.ts";
import { healthRoute } from "./routes/health.ts";
import { createSessionRoutes } from "./routes/session.ts";
import { createSetupRoutes } from "./routes/setup.ts";

const isProduction = process.env.NODE_ENV === "production";

// Opens the SQLite database and applies pending migrations before serving.
const db = openDatabase(process.env.DATA_DIR ?? "./data");
const setup = createSetupRoutes(db);
const session = createSessionRoutes(db);

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

    // Frontend SPA — catch-all must stay last so API routes take precedence.
    "/*": index,
  },
});

console.info(
  `🥟 DoughFolio is steaming at ${server.url} (${isProduction ? "production" : "development"})`,
);
