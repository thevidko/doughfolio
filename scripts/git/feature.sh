#!/usr/bin/env bash
# Start a new feature branch off the latest develop.
# Usage: bun run feature <kebab-case-name>
set -euo pipefail

name="${1:?Usage: bun run feature <kebab-case-name>   (e.g. manual-transactions)}"

if [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "✗ Feature name must be kebab-case, e.g. 'manual-transactions'." >&2
  exit 1
fi

git checkout develop
# Sync with the remote when one is configured (local-only repos skip this).
if git remote get-url origin >/dev/null 2>&1; then
  git pull --ff-only origin develop
fi

git checkout -b "feature/$name"
echo "✓ Created feature/$name off develop — happy steaming! 🥟"
