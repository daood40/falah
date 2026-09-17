#!/usr/bin/env bash
# Extracts this folder as a STANDALONE repository, with its own history.
#
# The service is already self-contained: its schema, importer, API, clients,
# tests, audit, Dockerfile and CI live in this folder and nothing outside it is
# required to build or run it. This script turns that into a real repository.
#
#   bash scripts/extract-repo.sh                      # build the branch only
#   bash scripts/extract-repo.sh <git-remote-url>     # …and push it
#
# What it does:
#   1. `git subtree split` — replays only the commits that touched this folder,
#      with this folder as the root. History is kept; nothing is squashed.
#   2. Refuses to continue if that history would carry edition text or a secret.
#   3. Optionally pushes the result to a remote you name.
#
# It never rewrites the monorepo: the split branch is a new, separate ref.
set -euo pipefail

cd "$(dirname "$0")/.."
PREFIX="$(basename "$PWD")"
cd ..

REMOTE="${1:-}"
BRANCH="${EXTRACT_BRANCH:-hadith-api-standalone}"

echo "→ splitting '$PREFIX' into branch '$BRANCH'"
git subtree split --prefix="$PREFIX" -b "$BRANCH" >/dev/null

# ---- refuse to publish the edition text or a credential -------------------
echo "→ checking the split history"
FORBIDDEN=$(git ls-tree -r --name-only "$BRANCH" \
  | grep -E '^(data/|exports/)|(^|/)\.env$' || true)
if [ -n "$FORBIDDEN" ]; then
  echo "REFUSING: the split branch carries files that must never be published:" >&2
  echo "$FORBIDDEN" >&2
  echo "The edition text is the owner's and its redistribution licence is not" >&2
  echo "confirmed. Remove those paths from history before publishing." >&2
  exit 1
fi

SECRETS=$(git grep -I -n -E \
  '(SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|ADMIN_API_KEY)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9/_+.-]{16,}' \
  "$BRANCH" -- . \
  | grep -vE '(\.env\.example|not-a-real|ci-admin-key|local-demo-key|\$\{|process\.env)' || true)
if [ -n "$SECRETS" ]; then
  echo "REFUSING: the split branch carries what looks like a real secret:" >&2
  echo "$SECRETS" >&2
  exit 1
fi

COMMITS=$(git rev-list --count "$BRANCH")
FILES=$(git ls-tree -r --name-only "$BRANCH" | wc -l)
echo "✓ branch '$BRANCH': $COMMITS commit(s), $FILES file(s), no corpus text, no secret"

cat <<NOTE

The branch is ready. To make it a repository:

  git checkout $BRANCH          # inspect it
  git push <remote-url> $BRANCH:main

Then point this project's Dart dependency at it:

  falah_hadith_api:
    git:
      url: <remote-url>
      path: clients/dart
      ref: main

NOTE

if [ -n "$REMOTE" ]; then
  echo "→ pushing '$BRANCH' to $REMOTE as main"
  git push "$REMOTE" "$BRANCH:main"
  echo "✓ pushed"
fi
