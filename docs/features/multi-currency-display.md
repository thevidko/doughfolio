# Feature: Multi-currency display

- **Status:** draft
- **Priority:** must-have (shortly after manual transactions)
- **Depends on:** setup-wizard (base currency, settings), price data layer

## Summary

Currency display is fully configurable and never region-locked. Every user
picks the currencies they care about, how amounts are formatted, and where
each currency applies (globally, per wallet, …). Motivated by the owner's
experience with a tracker that could not show amounts in their own currency.

## User stories

- As a user outside the USD world, I want all values in my own currency (CZK,
  PLN, INR, …) — any currency CoinGecko can quote, not a hardcoded shortlist.
- As a user, I want to add several display currencies and switch between them
  instantly (one click in the header), without changing my base currency.
- As a user with an EUR exchange account and a CZK budget, I want a specific
  wallet to display in a different currency than the rest of the app.
- As a bitcoiner, I want a BTC/sats display mode.
- As a Czech user, I want proper locale formatting (`1 234,56 Kč`), driven by
  my app language, with correct symbol placement.
- As a user, I want to optionally see a secondary currency alongside the
  primary one (e.g. small gray text under the main amount).

## Scope

**In:**

- Settings: ordered list of the user's **display currencies** (searchable add
  from the full supported list); the base currency (from setup) stays the
  accounting currency for P/L.
- **Quick switcher** in the app header cycling/selecting among display
  currencies; instant, client-side (rates already cached).
- **Per-wallet override**: a wallet may pin its own display currency;
  otherwise it inherits the global selection.
- Optional **secondary currency** shown alongside primary amounts.
- **BTC/sats mode** as a display currency with sensible unit switching
  (BTC ≥ 0.01, sats below — tune at implementation).
- Formatting: one shared money-formatting module in `src/shared/`
  (`Intl.NumberFormat` + app locale + currency), used by server and client;
  respects decision #9 (decimal strings in, formatted strings out).
- Supported currency list = CoinGecko `vs_currencies` (~60 fiat + crypto
  units), fetched and cached server-side; the UI always presents the full
  list with search.

**Out (explicitly not now):**

- Custom/manual exchange rates and currencies CoinGecko cannot quote.
- Multi-currency **accounting** (P/L stays computed in the base currency;
  other currencies are presentational conversions).
- Historical per-currency charts beyond converting the existing series.
- Tax reporting.

## UX / UI notes

- Currency switcher must be one interaction away from the dashboard at all
  times; pop animation on amount changes (DESIGN.md value-change rule).
- Never color-only for currency context; secondary amounts use `ink-soft`.

## Data model impact

- `settings`: `display_currencies` (ordered list), `secondary_currency`
  (nullable), `active_display_currency`.
- `wallets`: `display_currency` (nullable → inherits global).

## API

- `GET /api/currencies` — supported list (cached from CoinGecko).
- Settings endpoints gain the new fields; conversion rates ride along with the
  existing price endpoints (no separate rates API for the client).

## Acceptance criteria

- [ ] Any CoinGecko-supported currency can be added, displayed and switched
      to — verified with at least USD, CZK, JPY (0-decimal), and BTC/sats.
- [ ] Per-wallet override wins over the global selection; clearing it restores
      inheritance.
- [ ] Formatting follows the app locale (Czech: `1 234,56 Kč`; English:
      `Kč 1,234.56` or `CZK` code fallback) via the shared formatter, covered
      by unit tests.
- [ ] Switching display currency never re-fetches transaction data (uses
      cached rates) and never mutates stored values.
- [ ] P/L numbers remain computed in the base currency regardless of display
      selection (test proving display switch does not change stored P/L).

## Open questions

- Should the secondary currency be global-only, or also per-wallet?
- Do we want a "rounding profile" (e.g. hide cents above certain amounts)?
