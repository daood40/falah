-- 007: policies for the ops tables.
--
-- 001 enables AND forces row level security on every table in the schema, then
-- grants import_runs / audit_logs to service_role — but never creates a policy
-- for them. Forced RLS with no policy denies every row to every non-superuser,
-- so the import pipeline could not write its own run log when deployed under
-- service_role (it only worked here because the migrations run as superuser).
-- The policies below restore the intended posture explicitly: service_role may
-- work with the ops tables, anon and authenticated still have no policy and no
-- grant, so they can read nothing.

create policy import_runs_service on quran.import_runs
  for all to service_role using (true) with check (true);

create policy audit_logs_service on quran.audit_logs
  for all to service_role using (true) with check (true);

-- audit_logs is append-only for service_role: the grant already excludes
-- update and delete; this makes the intent explicit next to the policy.
revoke update, delete on quran.audit_logs from service_role;
