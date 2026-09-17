-- ============================================================
-- FALAH — Arabic search for the hadith corpus (schema: corpus)
-- Full Text Search + pg_trgm. Normalization is search-only and
-- NEVER touches the stored text (SOURCE_POLICY §2).
-- ============================================================

create extension if not exists pg_trgm;

-- Search-only Arabic normalization: diacritics, tatweel, hamza forms,
-- alef maqsura, ta marbuta, Arabic-Indic digits. Immutable so it can back
-- generated columns and expression indexes.
create or replace function corpus.normalize_ar(t text) returns text
language sql immutable as $$
  select case when t is null then null else
    btrim(regexp_replace(
      translate(
        regexp_replace(t, '[ً-ٰٟۖ-ۭـ]', '', 'g'),
        E'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩٫',
        E'اااايهوي0123456789.'
      ),
      '\s+', ' ', 'g'))
  end
$$;

-- Generated search columns (derived, never displayed, never exported).
alter table corpus.hadiths
  add column search_tsv tsvector
    generated always as (
      to_tsvector('simple',
        corpus.normalize_ar(coalesce(raw_text, '')) || ' ' ||
        corpus.normalize_ar(coalesce(takhrij, '')) || ' ' ||
        corpus.normalize_ar(coalesce(grading, '')) || ' ' ||
        corpus.normalize_ar(coalesce(original_reference, ''))
      )
    ) stored;

create index hadiths_search_tsv_idx on corpus.hadiths using gin (search_tsv);
create index hadiths_raw_trgm_idx on corpus.hadiths
  using gin (corpus.normalize_ar(raw_text) gin_trgm_ops);

alter table corpus.narrators
  add column search_tsv tsvector
    generated always as (
      to_tsvector('simple', corpus.normalize_ar(coalesce(name, '') || ' ' ||
        coalesce(kunya, '') || ' ' || coalesce(laqab, '')))
    ) stored;
create index narrators_search_tsv_idx on corpus.narrators using gin (search_tsv);
create index narrators_name_trgm_idx on corpus.narrators
  using gin (corpus.normalize_ar(name) gin_trgm_ops);

create index chapters_name_trgm_idx on corpus.chapters
  using gin (corpus.normalize_ar(name) gin_trgm_ops);
create index books_name_trgm_idx on corpus.books
  using gin (corpus.normalize_ar(name) gin_trgm_ops);
create index hadith_sources_name_trgm_idx on corpus.hadith_sources
  using gin (corpus.normalize_ar(source_name) gin_trgm_ops);

-- Aggregate stats used by /api/v1/stats — one query instead of six counts.
create or replace view corpus.stats_view as
select
  (select count(*) from corpus.sources)             as sources,
  (select count(*) from corpus.editions)            as editions,
  (select count(*) from corpus.books)               as books,
  (select count(*) from corpus.chapters)            as chapters,
  (select count(*) from corpus.hadiths)             as hadiths,
  (select count(*) from corpus.narrators)           as narrators,
  (select count(*) from corpus.hadiths where verified)                            as verified_hadiths,
  (select count(*) from corpus.hadiths where verification_status = 'pending')     as pending_hadiths,
  (select count(*) from corpus.hadiths where verification_status = 'needs_review') as needs_review_hadiths,
  (select count(*) from corpus.hadiths where verification_status = 'rejected')    as rejected_hadiths,
  (select count(*) from corpus.hadith_gradings)     as gradings,
  (select count(*) from corpus.raw_imports)         as imports;
