#!/usr/bin/env bash
# Commit all current changes and push the branch.
# Usage: bun run save "<commit message>"   (use Conventional Commits, e.g. "feat: add coin search")
set -euo pipefail

msg="${1:?Usage: bun run save \"<commit message>\"}"
branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" == "main" ]]; then
  echo "✗ Direct commits to main are not allowed — main only receives releases." >&2
  echo "  Start a branch with: bun run feature <name>" >&2
  exit 1
fi

# Quality gate — never commit broken code.
bun run check

git add -A
git commit -m "$msg"

if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin "$branch"
  echo "✓ Saved and pushed $branch"
else
  echo "✓ Saved on $branch (no 'origin' remote yet — commit is local only)"
fi
