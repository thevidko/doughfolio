# Feature: Portfolio analytics (prices, P/L engine, charts)

- **Status:** draft (design delegated to the agent by the owner, 2026-08-09)
- **Priority:** must-have (completes the core loop: record → value → insight)
- **Depends on:** manual-transactions

## Summary

Three layers that turn the transaction log into insight:

1. **Price layer** — CoinGecko-backed, aggressively cached in SQLite: asset
   catalog, spot prices, immutable daily history.
2. **P/L engine** — pure, shared, Decimal-based computation of holdings, cost
   basis, realized/unrealized P/L; both methods (weighted average & FIFO,
   PLANNING #10), staking-reward valuation per setting.
3. **Dashboard & charts** — portfolio value over time, allocation breakdowns
   (per asset / steamer / storage type incl. staked share), per-asset price
   charts with trade markers, and headline stat tiles.

## Price layer

- **Asset catalog**: cached CoinGecko coin list (id, symbol, name) in an
  `assets` table; refreshed on demand and at most weekly; asset search reads
  only the cache (works offline).
- **Spot prices**: `GET /simple/price` batched (many ids per request), cached
  per (asset, currency) with a 60 s TTL (PLANNING #1) in memory + SQLite.
- **Historical prices**: daily closes per (asset, date, currency) in a
  `historical_prices` table. The past is immutable → cached **forever**; only
  missing ranges are fetched (`market_chart/range`). Today's point = spot.
- **Politeness & resilience**: one server-side fetch queue, ~1 request/2 s,
  exponential backoff on 429, optional `COINGECKO_API_KEY` env (registered in
  the env-requirements registry) raising limits. Every UI consumer degrades
  gracefully: cached data with a "stale" hint beats an error page (the app
  must stay usable offline — CLAUDE.md).

## P/L engine (`src/shared/` — the most-tested code in the repo)

- **Input**: ordered transaction log per asset (across wallets), cost-basis
  method, `stakingRewardCostBasis` setting, historical rates for converting
  trade currencies to the base currency.
- **Output** per asset and aggregated: holdings, cost basis, average cost,
  unrealized P/L, realized P/L (with per-period breakdown), fees paid,
  rewards earned.
- **Rules**:
  - Weighted average and FIFO share one implementation surface; FIFO tracks
    lots, transfers move lots between wallets **without realizing P/L**.
  - Buy fees increase cost basis; sell fees reduce proceeds; transfer/reward
    fees are expensed at the fee asset's market price at `occurred_at`.
  - Rewards enter holdings at market price or zero basis per setting.
  - Trades quoted in non-base currencies convert via the daily historical
    rate of `occurred_at`'s date.
  - Pure functions of (log, prices, settings) — no I/O, fully deterministic,
    property-style tests (e.g. sum of per-wallet holdings equals per-asset
    total, P/L invariant under transfer shuffling).

## Dashboard & charts

Chart stack: **`lightweight-charts`** for time series (canvas, financial-grade,
fast with years of daily points) + **custom SVG** for donuts/sparklines (easy
to style kawaii: rounded strokes, design tokens, dark-mode via tokens).
Before implementation, the chart design pass follows `docs/DESIGN.md` and the
agent's dataviz guidance (form, color, accessibility).

- **Portfolio value over time** — area chart of daily portfolio value in the
  base currency (daily balances × daily closes); ranges 7D / 1M / 3M / 1Y /
  All; hover shows value + P/L vs. range start.
- **Allocation donuts** — by asset, by steamer (group), and by storage type —
  the hot/cold/**staked** split the owner asked for is one glance away.
- **Per-asset detail** — price line with buy/sell markers on the actual
  trades, holdings and P/L for that asset.
- **Stat tiles** — total value, 24 h change, unrealized P/L, realized P/L,
  fees paid, rewards earned; positive = matcha, negative = blush, never color
  alone (accessibility).
- Method switcher (average/FIFO) lives in Settings; charts and tiles react
  instantly (engine is pure — recompute client-side).

## Data model impact

New tables (all cache — droppable without data loss): `assets` (id, symbol,
name, refreshed_at), `historical_prices` (asset_id, currency, date, price
TEXT, PK on the triple), `spot_prices` (asset_id, currency, price TEXT,
fetched_at). New env var: optional `COINGECKO_API_KEY` (documented in
`.env.example`, wired into the env-requirements registry).

## API

`GET /api/assets?query=…`, `GET /api/prices/spot?assets=…&currency=…`,
`GET /api/portfolio/summary`, `GET /api/portfolio/history?range=…`,
`GET /api/portfolio/asset/:assetId`. Shapes in `src/shared/`; heavy numbers
travel as decimal strings, chart-ready series as numbers (PLANNING #9 edge
rule).

## Acceptance criteria

- [ ] P/L engine: exhaustive unit tests for both methods — buys/sells across
      wallets, transfers with network fees, rewards under both valuation
      modes, non-base-currency trades, 18-decimal quantities. Property tests
      for the invariants above.
- [ ] Historical prices are fetched once per (asset, date, currency) and
      never re-fetched; rate limiting verified with a fake clock.
- [ ] Offline instance: dashboard renders from cache with a stale indicator;
      no error page.
- [ ] Charts render in both languages and themes; reduced-motion disables
      chart animations; every label via i18n keys.
- [ ] Portfolio value chart matches a hand-computed fixture portfolio to the
      cent.

## Open questions

- Range granularity above 1 Y: daily points are fine for storage, but should
  the chart downsample (weekly) for readability? (Decide at implementation
  with real data.)
