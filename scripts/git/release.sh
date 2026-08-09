#!/usr/bin/env bash
# Cut a stable release: bump version on develop, merge into main, tag it.
# Usage: bun run release <semver>   (e.g. bun run release 0.2.0)
set -euo pipefail

version="${1:?Usage: bun run release <semver, e.g. 0.2.0>}"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✗ Version must be plain semver (e.g. 0.2.0), without a 'v' prefix." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "develop" ]]; then
  echo "✗ Releases are cut from develop (current: $branch)." >&2
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "✗ Uncommitted changes — run: bun run save \"<message>\" first." >&2
  exit 1
fi

# Quality gate — a release must be green.
bun run check

# Bump package.json version and commit it on develop.
bun pm pkg set version="$version"
git add package.json
git commit -m "chore: release v$version"

git checkout main
if git remote get-url origin >/dev/null 2>&1; then
  git pull --ff-only origin main
fi

git merge --no-ff develop -m "chore: release v$version"
git tag -a "v$version" -m "DoughFolio v$version"

if git remote get-url origin >/dev/null 2>&1; then
  git push origin main develop --tags
  echo "✓ Released v$version — pushed main, develop and the tag"
else
  echo "✓ Released v$version locally (no 'origin' remote yet)"
fi

# Day-to-day work continues on develop.
git checkout develop
