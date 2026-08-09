# Planning — pre-implementation decisions

This document tracks the recommended additions to the stack and the decisions
that must be made **before** feature implementation starts. Update the
**Decision** line of each item once it is settled; implemented decisions should
eventually be reflected in `CLAUDE.md` and this file trimmed.

## Recommended packages (not yet installed)

Per CLAUDE.md rule "no new dependencies without justification" — each package is
added only when its feature area is being implemented, not before.

| Package | Area | Why this one |
| --- | --- | --- |
| `zod` | Validation | Validate all external input (request bodies, third-party price APIs) at the boundary; infers TS types so the schema is the single source of truth. |
| `drizzle-orm` (+ built-in `bun:sqlite`) | Database | Type-safe SQL with zero runtime overhead; SQLite keeps self-hosting trivial (one file, backup = copy). Drizzle has first-class Bun SQLite support and built-in migrations. |
| `@tanstack/react-query` | FE data fetching | Caching, refetching, and loading/error states for API calls; removes hand-written `useEffect` fetch code (like in `ServerStatus.tsx`). |
| `@tanstack/react-router` or `react-router` | FE routing | Needed once the app has more than one page (dashboard, transactions, settings). TanStack Router has the better TypeScript story; decide when routing is added. |
| `lightweight-charts` | Charts | TradingView's canvas chart library — built for financial time series, small, fast. Alternative: Recharts (SVG, easier to style kawaii, weaker with large datasets). |
| `ccxt` | Exchange sync (later) | Unified read-only API for 100+ exchanges, if/when exchange import is added. Heavy dependency — only add when the feature is confirmed. |

Deliberately **not** recommended for now:

- **Hono / Express** — `Bun.serve` typed routes cover our API needs with zero
  dependencies. Revisit only if we need middleware ecosystems or RPC-style
  client typing.
- **Component libraries (shadcn/ui, MUI…)** — the kawaii visual identity is
  custom anyway; we build small components on Tailwind tokens instead.

## Open decisions

### 1. Price data source
- **Options:** CoinGecko (free, no key, ~30 req/min limit), CoinCap, CryptoCompare.
- **Recommendation:** CoinGecko free tier + aggressive server-side caching
  (prices cached per coin with a configurable TTL, e.g. 60 s), so one instance
  never hits rate limits regardless of how many browser tabs are open.
- **Decision (2026-08-09):** CoinGecko free tier with server-side caching.
  An optional API key via env variable can be added later for higher limits.

### 2. Tracking scope (MVP)
- **Options:** (a) manual transaction entry, (b) watch-only on-chain addresses,
  (c) read-only exchange API keys.
- **Recommendation:** MVP = (a) manual transactions with cost basis & P/L;
  add (b) watch-only addresses next; (c) exchange sync last (via `ccxt`).
- **Decision (2026-08-09):** all three source types are in scope for the
  product. Any API keys (exchanges, blockchain explorers) are provided by the
  self-hoster via configuration. **Architectural consequence:** the data model
  must treat every holding as belonging to a generic *source* (kind: `manual` |
  `wallet` | `exchange`) from day one. Implementation order stays
  manual → watch-only → exchange sync.

### 3. Database
- **Options:** SQLite via `bun:sqlite` vs. PostgreSQL.
- **Recommendation:** SQLite — ideal for self-hosting (single file, no extra
  container, backup = file copy). Drizzle keeps a later Postgres migration
  realistic if ever needed.
- **Decision (2026-08-09):** SQLite via `bun:sqlite` + Drizzle ORM.

### 4. Authentication model
- **Options:** single-user password login vs. multi-user accounts vs. none
  (rely on reverse proxy auth).
- **Recommendation:** single-user with password (session cookie); document
  reverse-proxy setups. Multi-user only if a real need appears — it complicates
  every table and query.
- **Decision (2026-08-09):** single account, with the password being
  **optional** — chosen during first-run setup and changeable later (for users
  who protect the instance with a reverse proxy instead). Multi-user is a
  possible future direction: the schema includes a `users` table (with one row
  for now) and user-owned rows reference it, so multi-user becomes a migration
  rather than a rewrite.

### 5. License
- **Options:** MIT (maximum openness) vs. AGPL-3.0 (keeps SaaS forks open —
  common for self-hosted apps).
- **Recommendation:** AGPL-3.0, matching the self-hosted ethos.
- **Decision (2026-08-09):** AGPL-3.0 (see `LICENSE`).

### 6. Deployment & CI
- **Plan:** multi-stage `Dockerfile` (oven/bun base image) + `docker-compose.yml`
  with a volume for the SQLite file; GitHub Actions running `bun run check` on
  every PR and building the image on tags.
- **Decision (2026-08-09):** implemented. Branching model, release channels,
  GitHub Actions pipelines and Docker packaging are all described in
  `docs/WORKFLOW.md`.

### 7. Base currency & localization
- **Recommendation:** user-configurable base currency (USD/EUR/CZK…) from day
  one — retrofitting it into P/L math is painful. UI in English only for now,
  but all user-facing strings kept in one place so i18n can be added later.
- **Decision (2026-08-09):** per recommendation (delegated by the owner).

### 8. Portfolio history
- **Problem:** the value-over-time chart needs historical portfolio snapshots.
- **Options:** periodic snapshots (cron inside the server) vs. recomputing from
  transaction history + historical price API on demand.
- **Recommendation:** recompute from transactions + daily historical prices
  (cached in SQLite) — works retroactively and survives downtime; snapshots can
  be added later as a cache layer.
- **Decision (2026-08-09):** per recommendation (delegated by the owner).
