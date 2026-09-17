-- ============================================================
-- FALAH — RLS & grants for the hadith corpus (schema: corpus)
-- Read-only for the public; every write path is server-side only.
-- ============================================================

-- On plain Postgres the Supabase roles do not exist; create no-login stand-ins
-- so this migration is testable anywhere (Supabase already has them).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema corpus to anon, authenticated, service_role;

-- ---------- role helper (Supabase JWT claim) ----------
create or replace function corpus.jwt_role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'anon')
$$;

create or replace function corpus.is_admin() returns boolean
language sql stable as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb
       -> 'app_metadata' ->> 'corpus_role') = 'admin',
    false)
$$;

-- ---------- enable RLS everywhere ----------
do $$
declare t text;
begin
  foreach t in array array[
    'sources','dataset_versions','editions','books','chapters','narrators',
    'hadiths','hadith_narrators','hadith_sources','hadith_gradings',
    'hadith_references','raw_imports','verification_records','audit_logs','app_settings']
  loop
    execute format('alter table corpus.%I enable row level security', t);
  end loop;
end $$;

-- ---------- public read: catalogue metadata ----------
do $$
declare t text;
begin
  foreach t in array array[
    'sources','dataset_versions','editions','books','chapters','narrators',
    'hadith_narrators','hadith_sources','hadith_gradings','hadith_references']
  loop
    execute format(
      'create policy %I on corpus.%I for select to anon, authenticated using (true)',
      t || '_public_read', t);
    execute format('grant select on corpus.%I to anon, authenticated', t);
  end loop;
end $$;

-- ---------- hadiths: no direct table access for the public ----------
-- The public reads through corpus.hadiths_public, which withholds the text
-- until CONTENT_LICENSE_CONFIRMED is true (§3).
revoke all on corpus.hadiths from anon, authenticated;
create policy hadiths_admin_read on corpus.hadiths
  for select to authenticated using (corpus.is_admin());

create or replace view corpus.hadiths_public
with (security_barrier = true) as
select
  h.id,
  h.edition_id,
  h.book_id,
  h.chapter_id,
  h.narrator_id,
  h.hadith_number,
  h.hadith_number_int,
  h.volume_number,
  h.page_number,
  case when corpus.content_license_confirmed() then h.raw_text end as raw_text,
  case when corpus.content_license_confirmed() then h.matn    end as matn,
  case when corpus.content_license_confirmed() then h.isnad   end as isnad,
  case when corpus.content_license_confirmed() then h.takhrij end as takhrij,
  h.grading,
  h.original_reference,
  h.original_hadith_number,
  h.source_locked,
  h.verified,
  h.verification_status,
  h.content_hash,
  h.dataset_version,
  corpus.content_license_confirmed() as text_available,
  h.created_at,
  h.updated_at
from corpus.hadiths h;

grant select on corpus.hadiths_public to anon, authenticated;
grant select on corpus.stats_view to anon, authenticated;

-- ---------- admin-only tables ----------
do $$
declare t text;
begin
  foreach t in array array['raw_imports','verification_records','audit_logs','app_settings']
  loop
    execute format(
      'create policy %I on corpus.%I for select to authenticated using (corpus.is_admin())',
      t || '_admin_read', t);
    execute format('grant select on corpus.%I to authenticated', t);
  end loop;
end $$;

-- ---------- no write policies exist for anon/authenticated ----------
-- Writes happen only through the service_role connection used by the API
-- server and the importer, and even then SOURCE_LOCK triggers apply.
grant all on all tables in schema corpus to service_role;
grant all on all sequences in schema corpus to service_role;
alter default privileges in schema corpus grant all on tables to service_role;
