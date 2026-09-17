-- ============================================================
-- FALAH Hadith API — cross-checking against independent corpora
--
-- The importer proves a record matches the FILE it came from. That says
-- nothing about whether the text really exists in the collection the author
-- attributes it to. This records the answer to that second question, computed
-- against a separate, independently published corpus.
--
-- Nothing here ever edits a hadith. A disagreement is recorded and raised for
-- a human; it is never "corrected" automatically.
-- ============================================================

create table corpus.reference_corpora (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  url text,
  license text,
  version text,
  record_count int,
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table corpus.cross_checks (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references corpus.hadiths (id) on delete cascade,
  reference_corpus_id uuid not null references corpus.reference_corpora (id) on delete cascade,

  -- the best match found in the independent corpus
  reference_collection text,               -- e.g. 'صحيح البخاري' — verbatim from the reference
  reference_key text,                      -- the reference's own id/urn
  reference_number text,                   -- the reference's own hadith number

  method text not null check (method in ('shingle_overlap', 'exact', 'manual')),
  /** share of the record's word-shingles found in the matched reference text */
  similarity numeric(5, 4) not null check (similarity >= 0 and similarity <= 1),
  verdict text not null check (verdict in ('corroborated', 'partial', 'not_found')),

  /** true when the author's own takhrij names the collection that matched */
  takhrij_agrees boolean,
  /** collections the author's takhrij named, as stored on this hadith */
  takhrij_collections text[] not null default '{}',

  details jsonb not null default '{}',     -- scores only, never reference text
  checked_at timestamptz not null default now(),

  unique (hadith_id, reference_corpus_id)
);

create index cross_checks_hadith_idx on corpus.cross_checks (hadith_id);
create index cross_checks_verdict_idx on corpus.cross_checks (verdict, similarity desc);
create index cross_checks_collection_idx on corpus.cross_checks (reference_collection);
create index cross_checks_agreement_idx on corpus.cross_checks (takhrij_agrees)
  where takhrij_agrees is not null;

alter table corpus.reference_corpora enable row level security;
alter table corpus.cross_checks enable row level security;

-- Verdicts carry no scripture, so they are public: an app can show "this text
-- was corroborated in صحيح البخاري" even while the text itself is withheld.
create policy reference_corpora_public_read on corpus.reference_corpora
  for select to anon, authenticated using (true);
create policy cross_checks_public_read on corpus.cross_checks
  for select to anon, authenticated using (true);
grant select on corpus.reference_corpora, corpus.cross_checks to anon, authenticated;
grant all on corpus.reference_corpora, corpus.cross_checks to service_role;

-- Per-dataset roll-up used by /api/v1/stats and the admin dashboard.
create or replace view corpus.cross_check_summary as
select
  h.dataset_version,
  r.slug                                                        as reference_slug,
  r.name                                                        as reference_name,
  count(*)                                                      as checked,
  count(*) filter (where c.verdict = 'corroborated')            as corroborated,
  count(*) filter (where c.verdict = 'partial')                 as partial,
  count(*) filter (where c.verdict = 'not_found')               as not_found,
  count(*) filter (where c.takhrij_agrees)                      as takhrij_agrees,
  count(*) filter (where c.takhrij_agrees = false)              as takhrij_disagrees,
  round(avg(c.similarity), 4)                                   as mean_similarity
from corpus.cross_checks c
join corpus.hadiths h on h.id = c.hadith_id
join corpus.reference_corpora r on r.id = c.reference_corpus_id
group by h.dataset_version, r.slug, r.name;

grant select on corpus.cross_check_summary to anon, authenticated;
