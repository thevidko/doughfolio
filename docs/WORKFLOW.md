# Git workflow & release channels

DoughFolio uses a simplified git-flow with two release channels.

## Branches

```
main      ──●───────────●──────  stable — only release merges land here, each tagged vX.Y.Z
             \         /
develop   ────●───●───●───●────  integration — always green (bun run check), source of dev builds
               \     /
feature/*       ●───●            one branch per feature, short-lived
```

| Branch      | Purpose                            | Rules                                          |
| ----------- | ---------------------------------- | ---------------------------------------------- |
| `main`      | Stable channel                     | Never commit directly; only `bun run release`. |
| `develop`   | Integration, dev/nightly channel   | Merges from `feature/*`; must stay green.      |
| `feature/*` | One feature or fix, kebab-case name | Branched off `develop`, merged back via `bun run finish`. |

## Daily loop (the only commands you need)

```sh
bun run feature manual-transactions   # 1. start work → creates feature/manual-transactions
# …edit code…
bun run save "feat: add transaction form"   # 2. commit + push (runs bun run check first)
# …more edits & saves…
bun run finish                        # 3. merge the feature into develop & delete the branch
bun run release 0.2.0                 # 4. (occasionally) cut a stable release from develop
```

Every script runs `bun run check` (typecheck + lint + tests) before touching
history — broken code cannot land on any shared branch.

Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, …) —
see `CLAUDE.md`.

## Release channels

- **Stable** — a `vX.Y.Z` tag on `main`, created by `bun run release`.
  Users self-host these. Semver discipline (owner request 2026-08-14):
  **minor** (`0.X.0`) for new features, **patch** (`0.X.Y`) for fixes and UI
  polish. Releases need not be cut per change — work can accumulate on
  `develop` (the edge channel) until a batch is worth shipping.
- **Dev (edge)** — the tip of `develop`. Once CI/CD is set up, every merge to
  `develop` will produce a dev build automatically.

## CI/CD (approved 2026-08-09)

1. **Checks** (`.github/workflows/ci.yml`) — every PR and every push to
   `develop`/`main` runs `bun run check`.
2. **Dev builds** (`.github/workflows/dev-build.yml`) — every merge to `develop`
   publishes the Docker image `ghcr.io/thevidko/doughfolio:edge` (per-merge
   "nightly"; always current, nothing builds when nothing changed).
3. **Stable builds** (`.github/workflows/release.yml`) — pushing a `v*` tag
   (done by `bun run release`) re-runs the checks, publishes
   `ghcr.io/thevidko/doughfolio:X.Y.Z` + `:latest`, and creates a GitHub
   Release with generated notes.
4. **Docker** (`Dockerfile`, `docker-compose.yml`) — image based on `oven/bun`;
   Bun bundles the frontend at startup so no build stage is needed. SQLite data
   lives in the `/data` volume; container healthcheck hits `GET /api/health`.
