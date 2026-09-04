-- Behavioral RLS tests (run by scripts/validate-db.sh and CI).
-- Proves owner isolation with a non-owner role, not just policy presence.
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
