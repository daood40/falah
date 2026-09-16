-- ============================================================
-- FALAH — human verification gate for Quran dataset releases
--
-- Automated checks (hashes, counts, mappings) prove that what we stored is what
-- the source shipped. They cannot prove that the source itself is sound. A
-- dataset version may therefore only reach `published` after a named person has
-- reviewed a sample and recorded the result here.
-- ============================================================

create table quran.human_verifications (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references quran.quran_dataset_versions (id) on delete cascade,
  verifier_name text not null check (length(btrim(verifier_name)) > 0),
  verifier_role text,
  verified_at timestamptz not null default now(),
  scope text not null check (length(btrim(scope)) > 0),
  sample_count integer not null check (sample_count > 0),
  result text not null check (result in ('approved', 'rejected', 'needs_changes')),
  notes text,
  evidence_url text,
  created_at timestamptz not null default now()
);
create index human_verifications_dataset_idx
  on quran.human_verifications (dataset_version_id, verified_at desc);

-- A dataset version is publishable only while an `approved` human verification
-- exists for it. The trigger refuses the transition, so no importer, admin
-- action or manual UPDATE can publish scripture without a human sign-off.
create or replace function quran.enforce_human_verification() returns trigger
language plpgsql as $fn$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not exists (
      select 1 from quran.human_verifications hv
      where hv.dataset_version_id = new.id and hv.result = 'approved'
    ) then
      raise exception
        'HUMAN_VERIFICATION_REQUIRED: dataset version % has no approved human verification', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $fn$;

create trigger dataset_versions_human_verification
  before insert or update on quran.quran_dataset_versions
  for each row execute function quran.enforce_human_verification();

alter table quran.human_verifications enable row level security;
alter table quran.human_verifications force row level security;

-- Readable by everyone (it is the provenance record); writable only by service_role.
create policy human_verifications_public_read on quran.human_verifications
  for select to anon, authenticated using (true);
grant select on quran.human_verifications to anon, authenticated;
grant select, insert on quran.human_verifications to service_role;
