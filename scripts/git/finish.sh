#!/usr/bin/env bash
# Merge the current feature branch back into develop and delete it.
# Usage: bun run finish
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" != feature/* ]]; then
  echo "✗ Not on a feature branch (current: $branch) — nothing to finish." >&2
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "✗ Uncommitted changes — run: bun run save \"<message>\" first." >&2
  exit 1
fi

# Quality gate before the merge lands in develop.
bun run check

git checkout develop
if git remote get-url origin >/dev/null 2>&1; then
  git pull --ff-only origin develop
fi

# --no-ff keeps a merge commit per feature, so history shows feature boundaries.
git merge --no-ff "$branch"

if git remote get-url origin >/dev/null 2>&1; then
  git push origin develop
  # Remove the remote copy of the feature branch if it was ever pushed.
  git push origin --delete "$branch" 2>/dev/null || true
fi

git branch -d "$branch"
echo "✓ Merged $branch into develop and deleted it"
