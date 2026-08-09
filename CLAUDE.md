# CLAUDE.md — DoughFolio

Guidance for AI agents (and humans) working in this repository.

## Project overview

**DoughFolio** is a self-hosted, open-source cryptocurrency portfolio tracker.
The brand is a cute Japanese steamed dumpling (bao/dango) mascot — warm, soft,
kawaii aesthetics. The name puns on "dough" (money) + "portfolio" + the Bun runtime.

- Full logo: `assets/branding/logo-full.png` (source of truth for the visual identity)
- Web-optimized assets: `src/client/assets/`

License: AGPL-3.0 (`LICENSE`).

**Before implementing a new feature area, check `docs/PLANNING.md`** — it lists
pending pre-implementation decisions and the agreed package choices. Do not
implement anything whose decision there is still `TBD`. Feature specifications
live in `docs/features/` (one file per feature, based on `TEMPLATE.md`); a
feature needs an approved spec before implementation starts.

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Runtime    | Bun (server, bundler, test runner, package manager) |
| Language   | TypeScript, strict mode, no `any`                   |
| Backend    | `Bun.serve` with typed routes                       |
| Frontend   | React 19 + Tailwind CSS 4 (via `bun-plugin-tailwind`) |
| Lint/format| Biome (`biome.json` is the single source of truth)  |
| Tests      | `bun test` (built-in runner)                        |

Use **Bun-native APIs** wherever possible (`Bun.serve`, `bun:sqlite`, `Bun.file`,
`bun:test`) instead of Node.js equivalents or third-party packages.

## Commands

```sh
bun install        # install dependencies
bun run dev        # dev server with HMR at http://localhost:3000
bun start          # production mode
bun test           # run all tests
bun run typecheck  # tsc --noEmit
bun run lint       # biome check
bun run lint:fix   # biome check --write
bun run check      # typecheck + lint + tests (run before finishing any task)
```

## Project structure

```
src/
  client/            # React frontend (SPA)
    assets/          # web-optimized images
    components/      # reusable UI components (one component per file)
    styles/          # global CSS + Tailwind design tokens
    App.tsx          # root component
    index.html       # entry — bundled by Bun's fullstack server
    main.tsx         # React bootstrap
  server/            # backend
    routes/          # one module per API route + colocated *.test.ts
    index.ts         # Bun.serve entrypoint
  shared/            # code shared by client & server (API types, utils)
assets/branding/     # original brand assets (not bundled)
```

Import via path aliases, never deep relative paths: `@client/*`, `@server/*`, `@shared/*`.

## Hard rules

1. **Everything in English** — code, comments, commit messages, docs, UI copy.
2. **Strict TypeScript** — never weaken `tsconfig.json`, never use `any`,
   `as` casts only with a comment justifying why they are safe.
3. **API contract lives in `src/shared/`** — any JSON crossing the HTTP boundary
   must have its type defined there and imported by both sides.
4. **Definition of done**: `bun run check` passes. A task is not complete while
   typecheck, lint, or tests fail.
5. **No new dependencies without justification** — prefer Bun built-ins; when a
   package is genuinely needed, explain the choice in the PR/commit description.
6. **Never commit secrets** — configuration comes from environment variables;
   document new variables in `.env.example`.
7. **Money is never a float** — amounts/prices are decimal strings + `decimal.js`
   (see `docs/PLANNING.md` #9). Plain `number` only for chart rendering at the
   very edge of the UI.
8. **No hardcoded UI copy** — every user-facing string goes through the i18n
   layer (typed translation keys; EN + CS catalogs). This includes server-side
   error messages, which return translation keys, not prose.

## Code style

- Biome enforces formatting (2 spaces, double quotes, semicolons, 100-col lines).
  Never hand-format against it; run `bun run lint:fix`.
- Comments explain **why**, not what. No commented-out code, no TODO without an
  issue reference. Public functions/types get a short JSDoc block.
- Prefer `type` over `interface` (use `interface` only for declaration merging).
- Named exports only; no `default` exports (better refactoring & grep-ability).
- Model state with discriminated unions rather than boolean flags
  (see `ServerStatus.tsx` for the pattern).
- Small, focused modules. If a file needs a scroll map, split it.

## Frontend guidelines

- Components must be **small, reusable, and typed** — props via an inline `type`
  or exported from the same file. One exported component per file, named after it.
- Use the **semantic design tokens** from `src/client/styles/globals.css`
  (`cream`, `dough`, `matcha`, `blush`, `ink`) — never raw Tailwind palette
  colors. The kawaii identity depends on this consistency.
- Tone of UI copy: friendly and playful (steamer/dumpling metaphors welcome),
  but never at the cost of clarity — this app handles people's money. The tone
  must carry across all languages (EN + CS), not just English.
- Both light and dark theme are first-class; using semantic tokens (never raw
  colors) is what keeps them consistent.
- Accessibility is not optional: meaningful `alt` texts, keyboard navigation,
  sufficient color contrast (the pastel palette makes this easy to get wrong).
- Charts and money formatting will be added later; when they are, all formatting
  helpers belong in `src/shared/` so the server can reuse them.

## Backend guidelines

- One route = one module in `src/server/routes/`, registered in `server/index.ts`.
  Keep handlers thin; business logic goes into service modules as the app grows.
- Validate all external input at the boundary (request bodies, third-party API
  responses). Never trust data from outside the process.
- The app is **self-hosted**: it must run fully offline except for explicit
  price-data fetches, store data locally, and never phone home.
- Schema changes only via new `drizzle-kit` migrations — shipped migrations are
  append-only and apply automatically on startup (upgrade rules:
  `docs/PLANNING.md` #14).

## Testing

- Tests are colocated: `foo.ts` → `foo.test.ts` in the same directory.
- Test behavior, not implementation details. Every API route gets at least a
  status + payload-shape test; pure logic (calculations, parsing) gets thorough
  unit tests — portfolio math must never silently break.
- Use `bun test`; no additional test frameworks.

## Git conventions

- Branching model: see `docs/WORKFLOW.md`. `main` = stable (releases only),
  `develop` = integration, `feature/*` = work branches. Use the helper scripts
  (`bun run feature|save|finish|release`) instead of raw git for these flows.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Small, focused commits with imperative English messages.
- Never commit `node_modules`, build output, `.env`, or local databases
  (see `.gitignore`); **do** commit `bun.lock`.
