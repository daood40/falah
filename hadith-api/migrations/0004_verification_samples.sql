-- ============================================================
-- FALAH — human sample verification (§48)
-- A batch record of a HUMAN comparing imported records against the
-- printed/authorised source. AI never fills this table.
-- ============================================================

create table corpus.verification_samples (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null references corpus.dataset_versions (version),
  edition_id uuid references corpus.editions (id) on delete set null,

  sample_size int not null check (sample_size > 0),
  sample_hadith_ids uuid[] not null,

  source_reference text,                   -- what the verifier compared against
  verifier text not null check (btrim(verifier) <> ''),
  verification_date timestamptz not null default now(),

  exact_matches int not null default 0 check (exact_matches >= 0),
  discrepancies jsonb not null default '[]',
  notes text,

  status text not null default 'pending'
    check (status in ('pending', 'passed', 'failed', 'blocked')),

  created_at timestamptz not null default now(),

  -- the declared size must match the ids actually listed
  constraint verification_samples_size_matches
    check (sample_size = coalesce(array_length(sample_hadith_ids, 1), 0)),
  -- "passed" is only reachable when every sampled record matched and
  -- no discrepancy was recorded — there is no partial pass
  constraint verification_samples_pass_is_earned
    check (status <> 'passed'
           or (exact_matches = sample_size and jsonb_array_length(discrepancies) = 0)),
  constraint verification_samples_matches_within_size
    check (exact_matches <= sample_size)
);

create index verification_samples_dataset_idx
  on corpus.verification_samples (dataset_version, verification_date desc);

alter table corpus.verification_samples enable row level security;
create policy verification_samples_admin_read on corpus.verification_samples
  for select to authenticated using (corpus.is_admin());
grant select on corpus.verification_samples to authenticated;
grant all on corpus.verification_samples to service_role;

-- Dataset-level verification state, read by /api/v1/admin/stats.
create or replace view corpus.verification_status_view as
select
  d.version                                        as dataset_version,
  (select count(*) from corpus.hadiths h where h.dataset_version = d.version) as hadiths,
  (select count(*) from corpus.hadiths h
    where h.dataset_version = d.version and h.verified)                       as verified_hadiths,
  (select count(*) from corpus.verification_samples s
    where s.dataset_version = d.version)                                      as samples,
  (select count(*) from corpus.verification_samples s
    where s.dataset_version = d.version and s.status = 'passed')              as passed_samples,
  (select max(s.verification_date) from corpus.verification_samples s
    where s.dataset_version = d.version)                                      as last_sample_at
from corpus.dataset_versions d;

grant select on corpus.verification_status_view to anon, authenticated;
