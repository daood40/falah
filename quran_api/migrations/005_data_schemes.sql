-- ============================================================
-- FALAH — declared data schemes
--
-- Two questions have more than one legitimate answer: which sajdah scheme the
-- app follows, and which printed mushaf's page placement it matches. They are
-- OWNER decisions, not engineering ones, so the system records the scheme it
-- is currently storing, its source, and whether the owner has confirmed it.
--
-- Nothing here changes stored data. It documents which convention the stored
-- data already follows, so the API can state it instead of implying it.
-- ============================================================

create table quran.data_schemes (
  id uuid primary key default gen_random_uuid(),
  scheme_kind text not null check (scheme_kind in ('sajdah', 'page', 'juz', 'hizb', 'ayah_numbering')),
  scheme_code text not null,
  scheme_version text not null,
  edition_id uuid references quran.quran_editions (id) on delete cascade,
  dataset_version text,
  source_id text references quran.sources (id),
  description text,
  /** What the stored data currently reflects, counted from the data itself. */
  observed_summary jsonb not null default '{}'::jsonb,
  /** Alternatives that exist in other references, for the owner to choose from. */
  alternatives jsonb not null default '[]'::jsonb,
  decision_status text not null default 'PENDING'
    check (decision_status in ('PENDING', 'CONFIRMED', 'SUPERSEDED')),
  decided_by text,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheme_kind, edition_id, scheme_version)
);
create index data_schemes_kind_idx on quran.data_schemes (scheme_kind, decision_status);

-- A scheme may only be CONFIRMED by a named person on a given date.
create or replace function quran.enforce_scheme_decision() returns trigger
language plpgsql as $fn$
begin
  if new.decision_status = 'CONFIRMED'
     and (new.decided_by is null or length(btrim(new.decided_by)) = 0) then
    raise exception 'SCHEME_DECISION_REQUIRES_OWNER: % cannot be CONFIRMED without decided_by',
      new.scheme_kind using errcode = 'check_violation';
  end if;
  if new.decision_status = 'CONFIRMED' and new.decided_at is null then
    new.decided_at := now();
  end if;
  new.updated_at := now();
  return new;
end $fn$;

create trigger data_schemes_decision
  before insert or update on quran.data_schemes
  for each row execute function quran.enforce_scheme_decision();

alter table quran.data_schemes enable row level security;
alter table quran.data_schemes force row level security;

create policy data_schemes_public_read on quran.data_schemes
  for select to anon, authenticated using (true);
grant select on quran.data_schemes to anon, authenticated;
grant select, insert, update on quran.data_schemes to service_role;
