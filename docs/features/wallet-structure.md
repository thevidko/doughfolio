# Feature: Wallet structure (steamers & baskets)

- **Status:** done (implemented 2026-08-14, released in v0.3.0)
- **Priority:** must-have (prerequisite for manual transactions)
- **Implementation note:** the `transactions` table ships already in this
  feature's migration (schema exactly per `manual-transactions.md`) so the
  wallet-deletion rule is enforceable and tested now; the transactions
  feature itself adds the API/UI on top without another schema change.
- **Depends on:** setup-wizard (done)

## Summary

Wallets are organized into a two-level hierarchy: **groups** ("steamers") →
**wallets** ("baskets"). A themed default group exists from day one; users can
add more (e.g. "Long-term", "Trading"). Every wallet can carry a **storage
type** — a user-manageable label (seeded with *hot* and *cold*) — plus one
built-in behavioral type, **staked**, which tracks staked funds and accepts
staking rewards. Balances are never stored: everything derives from the
transaction log (PLANNING #8); this feature builds the structure and its
management UI, the transactions themselves are the next feature.

## Owner decisions (2026-08-09)

- Multiple groups allowed, one level deep (no nesting); a default themed group
  is created automatically.
- Theming: default group is **"The Steamer"** (CS: **"Napařovák"**); wallets
  are visually presented as steamer **baskets** (the UI keeps the word
  "wallet"/"peněženka" alongside for clarity).
- Staking-reward cost basis is **configurable in settings**: market price at
  receipt (default) or zero basis.

## User stories

- As a user, I want my wallets grouped in steamers so the dashboard mirrors
  how I actually organize my crypto (long-term vs. play money).
- As a user, I want to label wallets by storage style (hot, cold, hardware…)
  with my own labels, and filter by them.
- As a staker, I want a wallet type that shows how much I have staked and lets
  me record staking rewards, so my portfolio reflects reality.
- As a user, I want to rename/reorder/delete groups and wallets safely — the
  app must never silently discard transaction history.

## Scope

**In:**

- **Groups ("steamers")**: create, rename, reorder, delete. Deleting a group
  moves its wallets to the default group (never deletes wallets). The default
  group can be renamed but not deleted. Migration assigns existing wallets
  (from setup) to the newly created default group.
- **Wallets ("baskets")**: create (name + optional storage type + group),
  rename, move between groups, reorder, delete — deletion allowed only while
  the wallet has no transactions (later: archive instead, out of scope now).
  `kind` stays `manual` (PLANNING #2); watch-only/exchange kinds plug into the
  same structure later.
- **Storage types**: user-managed list (create/rename/delete/recolor?) seeded
  with *hot* and *cold*. One built-in type **staked** with `behavior:
  staking` — renamable, not deletable, its behavior cannot be removed.
  Deleting a user type clears it from wallets (sets none). A wallet has at
  most one storage type.
- **Staking semantics** (structure-level; transactions arrive next feature):
  staked amount per asset = balance of wallets whose storage type has the
  staking behavior; moving funds to/from staking = transfer between wallets;
  **staking reward** = dedicated transaction type. New setting
  `stakingRewardCostBasis: "market" | "zero"` (default `market`).
- **Wallets page** (`/wallets`): steamers as sections, baskets as wobbly
  cards inside (DESIGN.md), drag-or-buttons reorder, storage-type chips,
  staked badge. Management of storage types lives in Settings (a minimal
  Settings page section is part of this feature).
- API CRUD under `/api/groups`, `/api/wallets`, `/api/storage-types`; shapes
  in `src/shared/`, validation with zod, error envelope with i18n keys.

**Out (explicitly not now):**

- Transactions, balances, P/L display (next feature — this one ships the
  structure they attach to).
- Wallet archiving, per-wallet display currency (multi-currency feature),
  wallet icons/colors beyond storage-type chip.
- Watch-only / exchange wallet kinds.

## UX / UI notes

- The steamer/basket visual is decoration on top of clear labels — money UI
  must stay unambiguous (CLAUDE.md tone rule).
- Empty states: an empty steamer shows the mascot + "add your first basket".
- All motion per DESIGN.md (pop on add, squash on press, reduced-motion safe).

## Data model impact

New migration:

- `wallet_groups`: id, user_id → users, name, sort_order, created_at;
  default group created for the existing user with the themed name in the
  user's language.
- `storage_types`: id, user_id → users, name, behavior (`plain` | `staking`),
  builtin (bool), sort_order; seeded rows: hot (plain), cold (plain),
  staked (staking, builtin).
- `wallets`: + group_id → wallet_groups (backfilled to default group),
  + storage_type_id → storage_types (nullable), + sort_order.
- `settings`: new key `stakingRewardCostBasis` (default `market`).

## API

`GET/POST /api/groups`, `PATCH/DELETE /api/groups/:id`;
`GET/POST /api/wallets`, `PATCH/DELETE /api/wallets/:id` (PATCH covers rename,
group move, storage type, sort); `GET/POST /api/storage-types`,
`PATCH/DELETE /api/storage-types/:id`. All request/response types in
`src/shared/api.ts`, schemas in `src/shared/schemas/`.

## Acceptance criteria

- [x] Fresh install and upgraded instance both end up with a default themed
      group containing all existing wallets (migration tested on a database
      created by v0.2.0).
- [x] Groups: create/rename/reorder work; deleting a group moves its wallets
      to the default group; the default group refuses deletion (error envelope
      with i18n key).
- [x] Wallets: create with group + storage type, rename, move, reorder;
      deletion is refused once transactions exist (test with a seeded
      transaction row).
- [x] Storage types: seeded hot/cold/staked; user CRUD works; *staked* can be
      renamed but not deleted; deleting a user type clears it from wallets.
- [x] `stakingRewardCostBasis` setting persists and defaults to `market`.
- [x] Wallets page renders groups/baskets in both languages and both themes;
      all strings via i18n keys.
- [x] Full API surface covered by route tests (status + payload shape + error
      cases).

## Open questions

_None — resolved 2026-08-09 (delegated): plain text chips in this feature;
per-type colors/icons arrive with a later visual-polish pass._
