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
| `decimal.js` | Money math | Arbitrary-precision decimal arithmetic — see decision 9; floats are forbidden for amounts. |
| `i18next` + `react-i18next` | Localization | Typed translation keys, JSON catalogs (EN + CS to start), correct Czech plural rules — see decision 7. |
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
  one — retrofitting it into P/L math is painful.
- **Decision (2026-08-09, revised):** base currency configurable from day one.
  Full i18n from the start: **English + Czech** catalogs, architecture open to
  more languages. All user-facing strings go through typed translation keys —
  hardcoded UI copy is forbidden. Language is chosen in the first-run setup
  wizard and changeable later in settings (stored in the DB, defaulting to the
  browser language). Server-side messages (e.g. validation errors) return
  translation keys so the client renders them in the active language.
  Implementation: `i18next` + `react-i18next` with typed resources — mature,
  handles Czech plural rules, and catalogs are plain JSON per language.

### 8. Portfolio history
- **Problem:** the value-over-time chart needs historical portfolio snapshots.
- **Options:** periodic snapshots (cron inside the server) vs. recomputing from
  transaction history + historical price API on demand.
- **Recommendation:** recompute from transactions + daily historical prices
  (cached in SQLite) — works retroactively and survives downtime; snapshots can
  be added later as a cache layer.
- **Decision (2026-08-09):** per recommendation (delegated by the owner).

### 9. Money precision
- **Problem:** crypto amounts have up to 18 decimal places; IEEE floats corrupt
  them (`0.1 + 0.2 !== 0.3`).
- **Decision (2026-08-09):** amounts and prices are **never** represented as
  `number` in business logic. Storage: SQLite `TEXT` holding decimal strings.
  Arithmetic: `decimal.js` in a shared money module (`src/shared/`), used by
  both server and client. `number` is allowed only at the very edge for chart
  rendering, never for stored values or P/L math.

### 10. Cost basis method
- **Options:** FIFO vs. weighted average (both acceptable for Czech taxes).
- **Decision (2026-08-09, owner):** **both, selectable in settings.** The P/L
  engine lives in `src/shared/`, is implemented against the raw transaction
  log (so both methods derive from the same data), and gets exhaustive unit
  tests — this is the most correctness-critical code in the app.

### 11. Asset identity
- **Decision (2026-08-09):** the canonical asset identifier is the
  **CoinGecko ID** (e.g. `bitcoin`); ticker symbols are display-only (symbols
  collide). Custom/unlisted assets with manual prices are a later feature but
  the schema keeps `asset_id` open to non-CoinGecko namespaces.

### 12. Theming
- **Decision (2026-08-09, owner):** light **and** dark mode from day one —
  system preference as default, toggle in settings. The kawaii palette gets a
  warm-dark variant via the existing design tokens; components must only ever
  use semantic tokens so both themes stay consistent.

### 13. API conventions
- **Decision (2026-08-09):** REST under `/api/*`, JSON only. Errors use a
  single envelope: `{ "error": { "code": "...", "messageKey": "...",
  "details"?: {...} } }` where `messageKey` is an i18n key. All request input
  validated with `zod` at the boundary; schemas shared via `src/shared/`.

### 14. Database migrations & upgrade path
- **Decision (2026-08-09):** `drizzle-kit` generated SQL migrations, committed
  to the repo and **applied automatically on server startup** — self-hosters
  should never run migration commands manually.
- **Upgrade structure (2026-08-09):**
  - Migrations are numbered SQL files in `src/server/db/migrations/`
    (`0001_….sql`, `0002_….sql`, …), generated by `drizzle-kit` from the schema,
    committed to the repo and shipped inside the Docker image.
  - Drizzle's migrator records applied migrations in a metadata table inside
    the SQLite file itself, so the database always knows its own version.
  - On startup — before the server accepts connections — the migrator applies
    any pending migrations **in order**. A fresh install runs all of them; an
    upgrade runs only the missing ones. Skipping releases (e.g. 0.2 → 0.5)
    works automatically because the chain is linear and cumulative.
  - **Automatic pre-upgrade backup:** when at least one migration is pending,
    the server first copies the SQLite file to
    `/data/backups/doughfolio-<old-version>-<date>.sqlite`. A failed upgrade is
    recovered by restoring that file and running the previous image tag.
  - **Rules:** migrations are append-only (never edit or delete a shipped
    file); every schema change goes through a new migration; destructive
    changes (dropping columns/tables) are split across two releases
    (deprecate in one, remove in a later one) whenever data loss is possible.
  - **Downgrades** are not supported automatically — restoring the
    pre-upgrade backup is the documented rollback path.
  - CI: a migration smoke test runs the full chain against a fresh database
    once the DB layer exists, so a broken chain can never ship.

### 15. Data portability
- **Decision (2026-08-09):** users own their data: CSV/JSON export and CSV
  transaction import are first-class planned features (post-MVP), and the
  schema/docs must keep them cheap — another reason all state lives in one
  SQLite file.

### 16. First-run setup wizard
- **Decision (2026-08-09):** on first launch the app shows a setup wizard:
  language → optional password → base currency. All three changeable later in
  settings.

### 17. Timestamps
- **Decision (2026-08-09):** storage and API use UTC ISO 8601 strings
  exclusively; conversion to local time happens only in the UI layer.

### 18. Configuration precedence
- **Decision (2026-08-09):** two clearly separated layers:
  - **Environment variables** = infrastructure concerns (`PORT`, `DATA_DIR`),
    set by the self-hoster, documented in `.env.example`.
  - **Database settings** = user preferences (language, base currency, theme,
    cost-basis method, password), edited in the app's settings UI.
  A value never lives in both layers.

### 19. Logging
- **Decision (2026-08-09):** log to stdout/stderr only (Docker-friendly,
  `docker logs` just works) via `console.info/warn/error` — no log files, no
  logging library until a concrete need appears.

### 20. API/frontend compatibility
- **Decision (2026-08-09):** no API versioning. Frontend and backend always
  ship together in one image, and the contract is enforced at compile time by
  the shared types in `src/shared/`.

### 21. Contributor & agent automation
- **Decision (2026-08-09):** conventions are enforced by machines, not memory:
  - Pre-commit hook runs `bun run check` (activated automatically by the
    `prepare` script on `bun install`; workflow scripts skip the duplicate run).
  - CI runs the same gate on every PR; images only build after green checks.
  - VS Code workspace settings format with Biome on save; issue/PR templates
    and `CONTRIBUTING.md` route outside contributors through the same rules.
- **Future (when outside contributors appear):** enable GitHub branch
  protection on `main`/`develop` requiring the CI check, and consider Renovate
  (needs the GitHub App installed by the owner) for dependency updates.
