# Feature: CSV import & export

- **Status:** approved (owner request 2026-08-14: "pojďme udělat feature na
  export a import dat, csv, párovat podle názvu sloupce, dialog na namapování")
- **Priority:** must-have (PLANNING #15 — users own their data; also the
  practical migration path from other trackers)
- **Depends on:** manual-transactions (done)

## Summary

Users export their full transaction log as CSV and import CSV exports from
other trackers through a mapping wizard: the app guesses which column is
which by header name, the user adjusts the mapping (including per-value
mapping of transaction types and fixed fallbacks like "everything is
bitcoin" or "prices are in CZK"), previews the result, and commits. Designed
against a real export from the owner's previous tracker (single-asset BTC
log with BUY/TRANSFER types, per-row price currency, fee currency column and
date-only timestamps).

## Scope

**In:**

- **Export** — `GET /api/export/transactions.csv`: every transaction with
  columns `wallet,type,asset,quantity,unit_price,price_currency,fee_quantity,
  fee_asset,occurred_at,note`. Round-trips through our own importer. Download
  button in Settings.
- **CSV parser/serializer** in `src/shared/csv.ts` — RFC-4180-ish (quoted
  fields, embedded commas/newlines, CRLF), `,` and `;` delimiters
  auto-detected, no new dependency.
- **Import wizard** (`/import`, linked from Settings and the Wallets page):
  1. Choose file + **target wallet**.
  2. `POST /api/import/preview` returns headers, row count, first rows and a
     **guessed mapping** (header-name heuristics: date/amount/price/currency/
     fee/note/type synonyms, EN + CS).
  3. Mapping form: per-field column selects (date, quantity, unit price,
     price currency, fee quantity, fee currency, note, type) — each mappable
     to a column **or a fixed value** (fixed asset via search, fixed
     currency, fixed type). The type column expands into **per-value
     mapping**: every distinct value (e.g. `BUY`, `TRANSFER`) maps to
     buy / sell / reward / transfer (with a destination-wallet select) /
     skip.
  4. `POST /api/import/commit` parses the full file server-side, validates
     every row, writes all transactions atomically, and reports
     `{imported, skipped: [{line, reason}]}` — a bad row never aborts the
     rest, it lands in the skipped list.
- **Normalization**: decimal commas accepted; date-only values become noon
  UTC (timezone-safe); numbers validated as positive decimal strings.
- **Fees**: fee columns import when the fee currency maps to a crypto asset
  (e.g. `BTC` → bitcoin). Zero fees are dropped. Non-zero **fiat** fees are
  skipped with a per-row warning (asset-typed fees only for now — folding
  fiat fees into cost basis is a later engine extension).

**Out (explicitly not now):**

- JSON full-instance export/backup (the SQLite file in `/data` is the backup;
  documented), scheduled exports.
- Duplicate detection on re-import (import into an empty wallet; documented).
- Exchange-specific presets (Binance/Kraken formats) — the generic mapper
  handles them; presets can come later.

## API

`GET /api/export/transactions.csv` (auth-gated, text/csv attachment);
`POST /api/import/preview` `{ csv }`; `POST /api/import/commit`
`{ csv, mapping }` — mapping schema in `src/shared/schemas/import.ts`.

## Acceptance criteria

- [ ] The owner's real export (17 rows: BUYs in CZK + a TRANSFER with BTC
      network fee, date-only timestamps) imports fully: correct quantities,
      prices, currencies, the transfer as a linked pair with its fee, and
      dates preserved — verified end-to-end.
- [ ] Export → import round-trip reproduces the same balances.
- [ ] Preview guesses the mapping for the owner's file without manual fixes.
- [ ] Broken rows (bad number, unknown date) are skipped and reported with
      line numbers; valid rows still import.
- [ ] Parser unit tests: quotes, embedded delimiters, CRLF, `;` files,
      decimal commas.
- [ ] All UI strings via i18n (EN + CS), both themes.

## Open questions

_None — designed directly against the owner's requirements and sample file._
