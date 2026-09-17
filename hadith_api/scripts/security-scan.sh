#!/usr/bin/env bash
# Secret and leak scan (§20). Fails the build on any hit.
#
#   bash scripts/security-scan.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0
note() { printf '%-58s %s\n' "$1" "$2"; }

# 1. real secret VALUES anywhere in the tracked tree (names are fine, values are not)
PATTERN='(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|JWT_SECRET|ADMIN_API_KEY|DATABASE_URL|PGPASSWORD)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9/_+.-]{16,}'
# Only files git would publish are scanned: a git-ignored local runtime file
# (e.g. the generated .staging.env) is not part of the tree that ships.
HITS=$(grep -rInE "$PATTERN" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=data --exclude-dir=exports \
  --exclude-dir=reports --exclude='*.log' --exclude='security-scan.sh' . 2>/dev/null \
  | while IFS= read -r line; do
      file="${line%%:*}"
      git check-ignore -q "$file" 2>/dev/null || printf '%s\n' "$line"
    done \
  | grep -vE '(\.env\.example|not-a-real|ci-admin-key|local-demo-key|falah:falah|postgres:falah|<|\$\{|process\.env|example\.com)' || true)
if [ -n "$HITS" ]; then note "1. secret values in the tree" "FAIL"; echo "$HITS" | head -10; FAIL=1;
else note "1. secret values in the tree" "PASS — none"; fi

# 2. .env files tracked by git
ENVS=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v example || true)
if [ -n "$ENVS" ]; then note "2. .env committed" "FAIL"; echo "$ENVS"; FAIL=1;
else note "2. .env committed" "PASS — only .env.example"; fi

# 3. private keys anywhere
# the scanner itself contains the patterns it looks for, so it excludes itself
KEYS=$(grep -rIl --exclude-dir=node_modules --exclude-dir=.git --exclude='security-scan.sh' \
  -e 'BEGIN RSA PRIVATE KEY' -e 'BEGIN PRIVATE KEY' -e 'BEGIN OPENSSH PRIVATE KEY' . 2>/dev/null || true)
if [ -n "$KEYS" ]; then note "3. private keys" "FAIL"; echo "$KEYS"; FAIL=1;
else note "3. private keys" "PASS — none"; fi

# 4. server-only names reaching a client bundle or app code
CLIENT_PATHS="clients ../flutter_app/lib ../src"
CLIENT_HITS=$(grep -rInE 'service_role|SERVICE_ROLE|DATABASE_URL|PGPASSWORD|JWT_SECRET' $CLIENT_PATHS 2>/dev/null \
  | grep -viE 'never|ممنوع|not in|no key|لا مفتاح' || true)
if [ -n "$CLIENT_HITS" ]; then note "4. server secrets in client code" "FAIL"; echo "$CLIENT_HITS" | head -5; FAIL=1;
else note "4. server secrets in client code" "PASS — none"; fi

# 5. the source text must never be committed (licence not confirmed)
TEXT=$(git ls-files | grep -E '^hadith_api/data/' || true)
if [ -n "$TEXT" ]; then note "5. corpus text committed" "FAIL"; echo "$TEXT" | head -5; FAIL=1;
else note "5. corpus text committed" "PASS — data/ is git-ignored"; fi

# 6. build artifacts (if any exist) carry no secrets
ART=$(ls -d ../dist ../flutter_app/build 2>/dev/null || true)
if [ -n "$ART" ]; then
  ART_HITS=$(grep -rIlE 'service_role|SUPABASE_SERVICE_ROLE_KEY|BEGIN PRIVATE KEY' $ART 2>/dev/null || true)
  if [ -n "$ART_HITS" ]; then note "6. build artifacts" "FAIL"; echo "$ART_HITS" | head -5; FAIL=1;
  else note "6. build artifacts" "PASS — scanned, clean"; fi
else note "6. build artifacts" "SKIPPED — none built here"; fi

echo
[ "$FAIL" -eq 0 ] && echo "SECURITY SCAN: PASS" || echo "SECURITY SCAN: FAIL"
exit "$FAIL"
