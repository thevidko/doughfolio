/**
 * DoughFolio server entrypoint.
 *
 * Uses Bun's fullstack dev server: the imported HTML file is bundled together
 * with its TSX/CSS imports, served with HMR in development, and API routes are
 * declared alongside it. Run with `bun run dev` (hot reload) or `bun start`.
 */
import index from "../client/index.html";
import { healthRoute } from "./routes/health.ts";

const isProduction = process.env.NODE_ENV === "production";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  development: !isProduction && { hmr: true, console: true },

  routes: {
    // API routes — keep each handler in its own module under `routes/`.
    "/api/health": healthRoute,

    // Frontend SPA — catch-all must stay last so API routes take precedence.
    "/*": index,
  },
});

console.info(
  `🥟 DoughFolio is steaming at ${server.url} (${isProduction ? "production" : "development"})`,
);
