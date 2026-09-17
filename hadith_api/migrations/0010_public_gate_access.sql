-- ============================================================
-- 0010 — the public view must be readable without exposing settings
-- ============================================================
-- corpus.hadiths_public calls corpus.content_license_confirmed(), which reads
-- corpus.app_settings. app_settings is an operator-only table, so an anonymous
-- caller selecting the public view was refused with "permission denied for
-- table app_settings": the public read path did not work at all for the role
-- it was written for.
--
-- The gate function now runs as its owner, so it can read the one setting it
-- needs while app_settings itself stays closed to the public. The function
-- still only ever returns a boolean — no setting value is exposed — and it
-- cannot be used to widen anything: it takes no arguments and reads one key.
create or replace function corpus.content_license_confirmed() returns boolean
language sql stable security definer set search_path = corpus, pg_temp as $$
  select coalesce((select value = 'true' from corpus.app_settings
                   where key = 'content_license_confirmed'), false)
$$;

revoke all on function corpus.content_license_confirmed() from public;
grant execute on function corpus.content_license_confirmed() to anon, authenticated, service_role;
