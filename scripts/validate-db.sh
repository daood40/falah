#!/usr/bin/env bash
# Validate the FALAH schema against a real PostgreSQL.
# Uses a local postgres service when available, otherwise Docker.
set -euo pipefail

DB=falah_validate

run_psql() {
  su postgres -c "psql -v ON_ERROR_STOP=1 -q $*" 2>/dev/null \
    || psql -v ON_ERROR_STOP=1 -q -U postgres "$@"
}

if pg_isready >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1; then
  echo "→ using local postgres"
  su postgres -c "dropdb --if-exists $DB && createdb $DB"
  for f in supabase/migrations/*.sql; do
    echo "   applying $f"
    su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB" < "$f"
  done
  echo "→ sanity checks"
  su postgres -c "psql -v ON_ERROR_STOP=1 -Atd $DB" <<'SQL'
select 'plans: ' || count(*) from subscription_plans;
select 'sources: ' || count(*) from content_sources;
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001');
insert into content_projects (user_id, title, type, format_id)
  values ('00000000-0000-0000-0000-000000000001', 'test', 'post', 'ig-post');
select 'project status: ' || status from content_projects limit 1;
select 'rls enabled: ' || count(*) from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;
SQL
  echo "→ RLS behavioral tests (owner isolation, not just policy presence)"
  su postgres -c "psql -v ON_ERROR_STOP=1 -Atd $DB" < scripts/rls-tests.sql
  echo "✓ schema valid (local postgres)"
  exit 0
fi

CONTAINER=falah-db-validate
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
echo "→ starting postgres container"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=falah postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
for f in supabase/migrations/*.sql; do
  echo "   applying $f"
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -q < "$f"
done
echo "✓ schema valid (docker)"
