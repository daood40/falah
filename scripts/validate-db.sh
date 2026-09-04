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
  su postgres -c "psql -v ON_ERROR_STOP=1 -Atd $DB" <<'SQL'
-- Two users, one project each; a non-owner role that RLS applies to.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-0000000000bb');
insert into content_projects (user_id, title, type, format_id) values
  ('00000000-0000-0000-0000-0000000000aa', 'a-proj', 'post', 'ig-post'),
  ('00000000-0000-0000-0000-0000000000bb', 'b-proj', 'post', 'ig-post');
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'rls_probe') then
    create role rls_probe;
  end if;
end $$;
grant usage on schema public, auth to rls_probe;
grant select, insert, update, delete on all tables in schema public to rls_probe;

-- Act as user A.
set role rls_probe;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';

-- A sees ONLY A's projects.
do $$
declare visible int; foreign_rows int;
begin
  select count(*) into visible from content_projects;
  select count(*) into foreign_rows from content_projects
    where user_id = '00000000-0000-0000-0000-0000000000bb';
  if foreign_rows <> 0 then
    raise exception 'RLS FAIL: user A can read user B rows (%)', foreign_rows;
  end if;
  if visible <> 1 then
    raise exception 'RLS FAIL: user A should see exactly 1 project, sees %', visible;
  end if;
end $$;

-- A cannot insert a project owned by B.
do $$
begin
  begin
    insert into content_projects (user_id, title, type, format_id)
      values ('00000000-0000-0000-0000-0000000000bb', 'forged', 'post', 'ig-post');
    raise exception 'RLS FAIL: user A inserted a row owned by user B';
  exception
    when insufficient_privilege or check_violation then null; -- expected
  end;
end $$;

-- A cannot read another user's publish audit.
do $$
declare n int;
begin
  select count(*) into n from publish_attempts;
  if n <> 0 then raise exception 'RLS FAIL: publish_attempts leaked % rows', n; end if;
end $$;

reset role;
select 'rls behavioral: pass';
SQL
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
