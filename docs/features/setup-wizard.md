# Feature: First-run setup wizard

- **Status:** draft
- **Priority:** must-have (first implemented feature)
- **Depends on:** — (this feature bootstraps the app's foundations: DB layer,
  i18n, routing, sessions. They are built as part of it, each as its own
  sub-task.)

## Summary

On first launch, DoughFolio guides the self-hoster through a step-by-step
wizard (one form per screen, pop transitions per DESIGN.md): language, display
name, optional password, base currency, and optionally their first wallets.
Every step has a sensible default and most can be skipped — finishing the
wizard must take under a minute. All choices are changeable later in Settings.

## User stories

- As a new self-hoster, I want a friendly guided setup so the app is usable
  immediately without reading documentation.
- As a Czech user, I want to switch to Czech in the very first step and have
  the rest of the setup (and app) speak Czech.
- As a privacy-minded user behind a reverse proxy, I want to skip the password
  step entirely.
- As a user, I want to create my first wallet(s) during setup so the dashboard
  isn't empty when I arrive.
- As a user who misconfigured the instance, I want a clear message telling me
  exactly which environment variable is missing, and a way to continue once I
  add it.

## Scope

**In:**

- Wizard flow (skippable steps, back navigation, progress indicator):
  1. **Welcome + language** — mascot greeting; language preselected from
     browser (`Accept-Language`/`navigator.language`), EN/CS options. Changing
     it re-renders the wizard immediately.
  2. **Display name** — what the app calls the user ("Welcome back, Vidko!").
     Default: skippable → generic greeting.
  3. **Password (optional)** — explicit choice: "protect with password" vs.
     "skip (I secure the instance myself)" with a short honest explanation.
     Hashing via `Bun.password` (argon2id). If set, a session is created for
     the person completing setup (they are not locked out).
  4. **Base currency** — select from supported fiat list (default: USD;
     CZK/EUR prominent). Powers all valuations (PLANNING #7).
  5. **First wallets (optional)** — create one or more wallets with just a
     name; `kind` is `manual` for now (PLANNING #2 source abstraction — the
     full wallet structure is a separate future feature). Skippable.
  6. **Done** — summary of choices, mascot celebration, CTA to dashboard.
- **Setup gate:** until setup is completed (flag in DB), all app routes
  redirect to `/setup`; after completion, `/setup` is no longer accessible
  (changes happen in Settings).
- **Foundations built as part of this feature** (each a reviewable sub-task):
  - DB layer: drizzle + `bun:sqlite`, auto-migrations on startup with
    pre-upgrade backup (PLANNING #14); tables: `users` (single row),
    `settings`, `wallets`, `sessions`.
  - i18n bootstrap: i18next + typed keys, `en.json` + `cs.json` catalogs
    (PLANNING #7).
  - Client routing (`/setup`, `/` dashboard placeholder, 404).
  - Session auth middleware (cookie, only enforced when a password is set).
  - Zod validation + shared error envelope (PLANNING #13).
  - **Env-requirements mechanism** (reusable): a server-side registry of
    features → required env variables. Endpoint `GET /api/env-status?feature=…`
    reports missing variables. Any form whose feature lacks its env shows a
    friendly blocking message naming the exact variable (e.g.
    `EXCHANGE_XYZ_API_KEY`), with a "Check again" button that re-validates;
    the docs note that changing `.env` requires an instance restart. Not
    actually consumed by the MVP wizard (CoinGecko needs no key) but shipped
    and tested here because watch-only/exchange features will rely on it.

**Out (explicitly not now):**

- Wallet structure beyond a name (types, addresses, exchange linking, icons) —
  separate feature.
- Multi-user, password recovery flows (single account; password reset =
  documented CLI/env escape hatch, designed in the auth hardening feature).
- API keys entered in the UI — keys live in `.env` only (owner decision).
- Theme selection step — theme defaults to system preference; toggle lives in
  the app header/Settings, not the wizard (keeps the wizard short).

## UX / UI notes

- One question per screen, big friendly typography (Baloo 2 headings), wobbly
  cards, pop transitions between steps, progress dots; mascot reacts subtly on
  each step (per DESIGN.md; all decorative motion respects reduced-motion).
- Skip is always visible but secondary — defaults must be safe.
- Copy tone: playful but clear; the password step explanation must be honest
  about what skipping means.

## Data model impact

New tables (initial migration `0001`): `users` (id, display_name,
password_hash nullable, created_at), `settings` (key, value — language,
base_currency, setup_completed_at), `wallets` (id, user_id, name, kind,
created_at), `sessions` (id, user_id, expires_at).

## API

All under `/api`, shapes in `src/shared/`: `GET /api/setup/status`,
`POST /api/setup/complete` (atomic: applies all wizard choices),
`POST /api/session` + `DELETE /api/session` (login/logout when password set),
`GET /api/env-status?feature=…`.

## Acceptance criteria

- [ ] Fresh instance redirects everything to `/setup`; completed instance
      never shows it again.
- [ ] Wizard completable with all steps skipped (pure defaults) — result:
      EN/browser language, generic greeting, no password, USD, no wallets.
- [ ] Language switch in step 1 immediately re-renders the wizard in Czech,
      including validation messages from the server (translation keys).
- [ ] Password, when set, is argon2id-hashed; the completing browser receives
      a valid session; a second browser is asked to log in.
- [ ] Created wallets appear in the DB with `kind = 'manual'` and correct
      owner.
- [ ] Env-requirements mechanism: a feature with a missing variable reports it
      by name; "Check again" unblocks after the variable is provided (covered
      by tests with a fake feature registry).
- [ ] All new logic covered by tests (migrations run on fresh DB, setup
      endpoints, session middleware, env registry).

## Open questions

- Is "name" the user's display name (assumed here), or should the instance
  itself also get a name (e.g. shown in the browser tab)?
- Base currency list for MVP: fixed shortlist (USD, EUR, CZK, GBP, …) or the
  full CoinGecko `vs_currencies` list?
