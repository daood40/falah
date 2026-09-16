-- ============================================================
-- FALAH — License Center
--
-- One row per licensable dataset: who owns it, what licence was granted, what
-- that licence actually permits, and the evidence for it. `CONFIRMED` is only
-- possible with evidence recorded — the trigger enforces that, so no automated
-- run can mark a licence confirmed on its own.
-- ============================================================

create table quran.license_records (
  id uuid primary key default gen_random_uuid(),
  -- what kind of material this covers
  dataset_kind text not null check (dataset_kind in (
    'software', 'quran_text', 'translation', 'tafsir', 'audio', 'reciter',
    'qiraat', 'riwayat', 'word_by_word', 'morphology', 'tajweed', 'metadata'
  )),
  -- the concrete thing: a translation slug, a reciter slug, a package name…
  subject text not null,
  source_id text references quran.sources (id) on delete set null,
  owner text,
  copyright_holder text,
  license text,
  license_url text,
  permission_reference text,
  redistribution text not null default 'unknown'
    check (redistribution in ('unknown', 'allowed', 'denied')),
  commercial_use text not null default 'unknown'
    check (commercial_use in ('unknown', 'allowed', 'denied')),
  modification text not null default 'unknown'
    check (modification in ('unknown', 'allowed', 'denied', 'forbidden_by_policy')),
  attribution_required boolean not null default true,
  attribution_text text,
  expires_at date,
  evidence text,
  evidence_url text,
  status text not null default 'UNKNOWN'
    check (status in ('UNKNOWN', 'PENDING', 'RESTRICTED', 'CONFIRMED', 'REJECTED')),
  recorded_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dataset_kind, subject)
);
create index license_records_status_idx on quran.license_records (status);

-- CONFIRMED demands evidence and an explicit redistribution answer.
create or replace function quran.enforce_license_evidence() returns trigger
language plpgsql as $fn$
begin
  if new.status = 'CONFIRMED' then
    if new.evidence is null or length(btrim(new.evidence)) = 0 then
      raise exception 'LICENSE_EVIDENCE_REQUIRED: % / % cannot be CONFIRMED without evidence',
        new.dataset_kind, new.subject using errcode = 'check_violation';
    end if;
    if new.redistribution = 'unknown' then
      raise exception 'LICENSE_EVIDENCE_REQUIRED: % / % cannot be CONFIRMED while redistribution is unknown',
        new.dataset_kind, new.subject using errcode = 'check_violation';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $fn$;

create trigger license_records_evidence
  before insert or update on quran.license_records
  for each row execute function quran.enforce_license_evidence();

alter table quran.license_records enable row level security;
alter table quran.license_records force row level security;

-- Internal-only: readable by an authenticated caller, writable by service_role.
-- Anonymous callers get nothing while the project is private.
create policy license_records_internal_read on quran.license_records
  for select to authenticated using (true);
grant select on quran.license_records to authenticated;
grant select, insert, update on quran.license_records to service_role;

-- A view the release gate reads: every kind that must be CONFIRMED before the
-- corresponding content may be published.
create or replace view quran.license_gate as
  select
    dataset_kind,
    count(*) filter (where status = 'CONFIRMED')::int as confirmed,
    count(*) filter (where status in ('PENDING', 'UNKNOWN'))::int as pending,
    count(*) filter (where status = 'RESTRICTED')::int as restricted,
    count(*) filter (where status = 'REJECTED')::int as rejected,
    count(*)::int as total,
    bool_and(status = 'CONFIRMED') as all_confirmed
  from quran.license_records
  group by dataset_kind;
grant select on quran.license_gate to authenticated, service_role;
