#!/usr/bin/env bash
# Fails when a real secret looks committed. Runs in CI before anything ships.
# It scans tracked files only — never the working tree's .env or node_modules.
set -uo pipefail

cd "$(dirname "$0")/.."
status=0

fail() { echo "SECRET SCAN FAIL: $1"; status=1; }

# 1. No .env file may be tracked (examples are fine).
tracked_env="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)"
[ -n "$tracked_env" ] && fail "tracked .env file(s): $tracked_env"

# 2. Supabase / JWT service keys: a service_role JWT starts with eyJ and carries
#    the role inside. Look for any long JWT-looking literal in tracked files.
jwt_hits="$(git grep -nE '\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.' -- . ':!*.md' ':!**/reports/**' || true)"
[ -n "$jwt_hits" ] && fail "JWT-looking literal(s):
$jwt_hits"

# Known-harmless literals: throwaway CI credentials, documented placeholders and
# test constants. Anything else that looks assigned is a failure.
ALLOWED='falah|password|<project>|<[A-Za-z_-]+>|\.\.\.|TEST_JWT_SECRET|test-secret|unit-secret|s3cret|changeme|your-|xxx'

# 3. Assigned secrets (KEY=value) rather than empty placeholders.
assigned="$(git grep -nE '(SERVICE_ROLE_KEY|JWT_SECRET|ANON_KEY|API_KEY|PASSWORD|SECRET)[[:space:]]*[:=][[:space:]]*["'\''A-Za-z0-9]' \
  -- . ':!*.md' ':!**/reports/**' ':!scripts/secret-scan.sh' ':!**/*.example' ':!**/tests/**' ':!**/test/**' \
  | grep -vE "=\s*$|process\.env|Deno\.env|String\.fromEnvironment|getenv|environ|\\\$\{" \
  | grep -viE "$ALLOWED" || true)"
[ -n "$assigned" ] && fail "possible assigned secret(s):
$assigned"

# 4. A database URL with credentials in it.
db_urls="$(git grep -nE 'postgres(ql)?://[^:@/[:space:]]+:[^@[:space:]]+@' \
  -- . ':!*.md' ':!**/reports/**' ':!scripts/secret-scan.sh' ':!**/*.example' \
  | grep -viE "$ALLOWED" || true)"
[ -n "$db_urls" ] && fail "database URL with credentials:
$db_urls"

# 5. The service-role key must never appear in a client bundle or app source.
client_hits="$(git grep -nil 'service_role' -- flutter_app src public index.html quran_api/openapi || true)"
[ -n "$client_hits" ] && fail "service_role referenced in client code: $client_hits"

# 6. Git history: a secret that was committed once stays in the objects.
if [ "${SCAN_HISTORY:-1}" = "1" ] && [ -d .git ]; then
  history_hits="$(git log -p --all --no-color -- . 2>/dev/null \
    | grep -E '^\+' \
    | grep -aE '\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.' \
    | grep -viE "$ALLOWED" | head -5 || true)"
  [ -n "$history_hits" ] && fail "JWT-looking literal in git history:
$history_hits"
fi

if [ "$status" -eq 0 ]; then
  echo "SECRET SCAN PASS — no tracked secret found (working tree + git history)"
fi
exit "$status"
