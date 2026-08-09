# Contributing to DoughFolio 🥟

Thanks for considering a contribution!

## Ground rules

- **[CLAUDE.md](CLAUDE.md) is the rulebook** — code style, project structure,
  testing and hard rules. It applies to humans and AI agents alike.
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** describes branches and releases:
  PRs target `develop`, `main` only receives releases.
- Features need a spec in `docs/features/` (based on `TEMPLATE.md`) before
  implementation — open an issue first to discuss bigger ideas.

## Getting started

```sh
bun install       # also activates the repo's git hooks
bun run dev       # dev server with HMR → http://localhost:3000
bun run check     # typecheck + lint + tests — must pass before every commit
```

The pre-commit hook runs `bun run check` automatically, and CI runs the same
gate on every PR — a red check cannot merge or ship.

## Commits

Conventional Commits in English: `feat:`, `fix:`, `refactor:`, `test:`,
`docs:`, `chore:`, `ci:`. Small, focused commits, please.
