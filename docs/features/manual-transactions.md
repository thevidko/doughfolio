# Feature: Manual transactions

- **Status:** draft (data model designed ahead of time to validate
  wallet-structure; UI details may still evolve)
- **Priority:** must-have (the heart of the app)
- **Depends on:** wallet-structure

## Summary

Users record their crypto activity as transactions inside wallets: buys,
sells, transfers between wallets, and staking rewards. Everything else in the
app (balances, staked amounts, P/L, charts) derives from this append-only log
— transactions are the single source of truth (PLANNING #8), stored with
decimal-string amounts (PLANNING #9).

## Transaction model (the core design)

One row = one movement in one wallet. Types:

| Type | Effect on wallet balance | Notes |
| --- | --- | --- |
| `buy` | + quantity | price + currency recorded |
| `sell` | − quantity | price + currency recorded; realizes P/L |
| `transfer_out` | − quantity | linked 1:1 to a `transfer_in` |
| `transfer_in` | + quantity | linked 1:1 to a `transfer_out` |
| `reward` | + quantity | staking reward; cost basis per `stakingRewardCostBasis` setting |

- **Transfers are two linked rows** (same `transfer_group_id`), created and
  edited atomically. Per-wallet balance is then a plain SUM over that wallet's
  rows — no special cases. Moving funds into staking = an ordinary transfer
  into a staking-behavior wallet; "staked amount" needs no extra bookkeeping.
- Transfers never realize P/L; under FIFO the lots travel with the funds.
- **Prices are recorded as entered**: `unit_price` (decimal string) +
  `price_currency` (any supported currency, defaults to the base currency).
  The P/L engine converts to the base currency via cached historical rates —
  the record stays an honest copy of what actually happened on the exchange.
- **Fees**: optional `fee_quantity` + `fee_asset_id` per transaction (fees are
  paid in the traded asset, the quote currency, or an exchange token — hence
  asset-typed, not currency-typed). The P/L engine treats fees as cost.

### Columns (`transactions`)

id, user_id, wallet_id → wallets, type, asset_id (PLANNING #11 namespace),
quantity (TEXT decimal, > 0; sign derives from type), unit_price (TEXT
decimal, nullable — buys/sells only), price_currency (nullable),
fee_quantity (TEXT decimal, nullable), fee_asset_id (nullable),
transfer_group_id (nullable, links transfer pairs),
occurred_at (UTC ISO — user-editable, backdating is the norm),
note (nullable), created_at.

### Consistency rules

- Editing/deleting one side of a transfer edits/deletes both (atomic).
- A wallet with transactions cannot be deleted (already enforced by
  wallet-structure); assets never go negative silently — the UI warns when a
  sell/transfer_out exceeds the computed balance at that timestamp, but does
  not block (imports arrive out of order), the wallet just shows a warning
  badge until resolved.
- All amounts validated as positive decimal strings at the boundary (zod).

## Scope

**In:**

- CRUD UI: add/edit/delete transaction from a wallet detail page; type-aware
  form (buy/sell: quantity + price + currency + fee; transfer: from → to
  wallet; reward: quantity only), asset picker with search (CoinGecko id +
  symbol + name, cached list).
- Transactions list per wallet + per group, sorted by `occurred_at`, with
  running balance column.
- Balance derivation service in `src/shared/` (pure, heavily tested): per
  wallet, per group, per asset, staked per asset.
- First slice of the **price layer**: cached CoinGecko lookups needed here —
  asset search list + spot prices for showing current value of balances.
  (Historical prices & the P/L engine are the next feature — this one records
  data and shows balances/current value only.)

**Out (explicitly not now):**

- P/L computation and charts (needs historical prices — separate feature that
  consumes this log; both cost-basis methods per PLANNING #10).
- CSV import/export (PLANNING #15), watch-only/exchange sync.
- Transaction types beyond the table above (airdrops, mining, lending — the
  `type` column is TEXT, adding types is a data change, not a schema change).

## UX / UI notes

- Adding a transaction must be fast: open from wallet, sensible defaults
  (today's date, base currency), Enter submits. Pop animation on the new row.
- Amount inputs are text fields with decimal validation — never `number`
  inputs (float rule); locale-aware decimal comma accepted in the UI layer.

## API

`GET /api/wallets/:id/transactions`, `POST /api/transactions`,
`PATCH/DELETE /api/transactions/:id` (transfer pairs handled atomically),
`GET /api/assets?query=…` (search), `GET /api/prices?assets=…` (spot, cached).
Shapes in `src/shared/`, zod at the boundary, error envelope keys.

## Acceptance criteria

- [ ] All five types recordable and editable; transfer edit/delete stays
      atomic across both rows (tests).
- [ ] Balances (wallet/group/asset/staked) derive correctly from a seeded log
      — exhaustive unit tests on the shared derivation module, including
      out-of-order timestamps and the overdraw warning case.
- [ ] Reward transactions respect `stakingRewardCostBasis` storage (the
      valuation itself lands with the P/L feature, the data must be complete).
- [ ] Decimal strings survive round-trips untouched (no float corruption) —
      test with 18-decimal quantities.
- [ ] Asset search and spot prices work offline-degraded: cached data served,
      failures surface as the standard error envelope, UI stays usable.

## Cross-check against wallet-structure (2026-08-09)

The wallet-structure schema holds up with **no changes needed**: transactions
reference `wallet_id` only; staking needs no wallet-level state (balance of
staking-behavior wallets); groups are pure organization. One consequence
adopted there: wallet deletion is blocked once transactions exist.

## Open questions

- Should `price_currency` allow crypto quotes (BTC pairs) in the MVP form, or
  fiat only with crypto pairs later? (Schema supports both either way.)
