#!/usr/bin/env bash
# Brings up a STAGING deployment of the API and leaves it running.
#
#   * the staging database is restored from a pg_dump of the verified corpus,
#     so staging runs on a restored backup, not on the production database;
#   * the server runs as its own OS process on its own port, so the audit talks
#     to it over HTTP from outside the server, exactly like any client;
#   * both content gates stay closed (CONTENT_LICENSE_CONFIRMED=false,
#     PUBLIC_DATA_ENABLED=false) — staging must never publish the real text.
#
# Usage: bash scripts/staging-up.sh   (writes .staging.env and .staging.pid)
set -euo pipefail

cd "$(dirname "$0")/.."

SRC_DB="${SRC_DB:-falah_corpus_r2}"
STAGING_DB="${STAGING_DB:-falah_corpus_staging}"
ROLE="${TEST_DB_ROLE:-falah}"
PASS="${TEST_DB_PASSWORD:-falah}"
PORT="${STAGING_PORT:-8799}"
RL_PORT="${RATELIMIT_PORT:-8800}"
export PGPASSWORD="$PASS"

DUMP="$(mktemp -t staging-dump-XXXXXX.sql)"
echo "→ dumping $SRC_DB"
pg_dump -U "$ROLE" -h 127.0.0.1 -d "$SRC_DB" -f "$DUMP"

echo "→ restoring into $STAGING_DB"
dropdb -U "$ROLE" -h 127.0.0.1 --if-exists "$STAGING_DB"
createdb -U "$ROLE" -h 127.0.0.1 "$STAGING_DB"
psql -U "$ROLE" -h 127.0.0.1 -q -v ON_ERROR_STOP=1 -d "$STAGING_DB" -f "$DUMP" >/dev/null
rm -f "$DUMP"

# A restored database carries no planner statistics: without this the first
# queries against staging are orders of magnitude slower than production.
psql -U "$ROLE" -h 127.0.0.1 -q -d "$STAGING_DB" -c 'analyze' >/dev/null

SRC_COUNT=$(psql -U "$ROLE" -h 127.0.0.1 -tAc 'select count(*) from corpus.hadiths' -d "$SRC_DB")
DST_COUNT=$(psql -U "$ROLE" -h 127.0.0.1 -tAc 'select count(*) from corpus.hadiths' -d "$STAGING_DB")
SRC_HASH=$(psql -U "$ROLE" -h 127.0.0.1 -tAc "select dataset_hash from corpus.dataset_versions where status='sealed'" -d "$SRC_DB")
DST_HASH=$(psql -U "$ROLE" -h 127.0.0.1 -tAc "select dataset_hash from corpus.dataset_versions where status='sealed'" -d "$STAGING_DB")
[ "$SRC_COUNT" = "$DST_COUNT" ] || { echo "FAIL: record count $SRC_COUNT != $DST_COUNT"; exit 1; }
[ "$SRC_HASH" = "$DST_HASH" ] || { echo "FAIL: dataset hash mismatch"; exit 1; }
echo "  restored $DST_COUNT records, dataset hash $DST_HASH"

ADMIN_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
cat > .staging.env <<ENV
ENVIRONMENT=staging
PORT=$PORT
DATABASE_URL=postgresql://$ROLE:$PASS@127.0.0.1:5432/$STAGING_DB
CONTENT_LICENSE_CONFIRMED=false
PUBLIC_DATA_ENABLED=false
ADMIN_API_KEY=$ADMIN_KEY
RATE_LIMIT_MAX=1000000
RATE_LIMIT_WINDOW_MS=60000
ACTIVE_DATASET_VERSION=${DATASET:-JAMI-KAMIL-1437-V2}
CORS_ORIGINS=*
ENV
chmod 600 .staging.env

echo "→ starting API on :$PORT"
node --env-file=.staging.env --experimental-strip-types src/http/server.ts \
  > .staging.log 2>&1 &
echo $! > .staging.pid

# a second instance with a tiny rate limit, so the limiter can be proved
# without throttling the audit itself
sed -e "s/^PORT=.*/PORT=$RL_PORT/" -e "s/^RATE_LIMIT_MAX=.*/RATE_LIMIT_MAX=5/" .staging.env > .staging-rl.env
chmod 600 .staging-rl.env
node --env-file=.staging-rl.env --experimental-strip-types src/http/server.ts \
  > .staging-rl.log 2>&1 &
echo $! > .staging-rl.pid

for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl -fsS "http://127.0.0.1:$PORT/api/v1/health" >/dev/null || { echo "FAIL: staging did not become healthy"; cat .staging.log; exit 1; }
echo "✓ staging up: http://127.0.0.1:$PORT  (rate-limit instance :$RL_PORT)"
