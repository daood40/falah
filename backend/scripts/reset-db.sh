#!/usr/bin/env bash
# Rebuilds a local PostgreSQL database from supabase/migrations for tests.
# Local development only — never pointed at a production database.
set -euo pipefail

DB="${TEST_DB_NAME:-falah_corpus_test}"
ROLE="${TEST_DB_ROLE:-falah}"
PASS="${TEST_DB_PASSWORD:-falah}"
MIGRATIONS="$(cd "$(dirname "$0")/../.." && pwd)/supabase/migrations"

as_postgres() { su postgres -c "$1" 2>/dev/null || sudo -u postgres bash -c "$1"; }

pg_isready >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 || true

as_postgres "psql -v ON_ERROR_STOP=1 -q -c \"do \\\$\\\$ begin
  if not exists (select 1 from pg_roles where rolname = '$ROLE') then
    create role $ROLE login superuser password '$PASS';
  end if; end \\\$\\\$;\""
as_postgres "dropdb --if-exists $DB"
as_postgres "createdb -O $ROLE $DB"

for f in "$MIGRATIONS"/*.sql; do
  as_postgres "psql -v ON_ERROR_STOP=1 -q -d $DB" < "$f"
done
echo "✓ test database ready: postgresql://$ROLE@127.0.0.1:5432/$DB"
