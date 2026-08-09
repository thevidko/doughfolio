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
  Users self-host these.
- **Dev (edge)** — the tip of `develop`. Once CI/CD is set up, every merge to
  `develop` will produce a dev build automatically.

## Planned CI/CD (pending approval — do not implement yet)

The intended GitHub Actions setup, to be confirmed before any files are added:

1. **Checks** — every PR and every push to `develop`/`main` runs `bun run check`.
2. **Dev builds** — every merge to `develop` publishes a Docker image
   `ghcr.io/<owner>/doughfolio:edge` (per-merge "nightly"; simpler and fresher
   than a cron-based nightly, can switch to cron later if image churn is an issue).
3. **Stable builds** — pushing a `v*` tag publishes `ghcr.io/<owner>/doughfolio:X.Y.Z`
   + `:latest`, and creates a GitHub Release with generated notes.
4. **Docker** — multi-stage image based on `oven/bun`, SQLite data in a `/data`
   volume, container healthcheck via `GET /api/health`.
# smoke test
