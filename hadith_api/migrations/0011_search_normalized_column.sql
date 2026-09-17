-- ============================================================
-- 0011 — store the normalized text instead of recomputing it per row
-- ============================================================
-- The substring branch of /api/v1/search matched on an EXPRESSION index over
-- corpus.normalize_ar(raw_text). Every index recheck re-ran three regular
-- expressions over the row's text, so a very common short term
-- (e.g. "من", present in most records) cost ~1.3 s in the database and ~3 s
-- end to end.
--
-- The normalized form is now stored in a generated column and the trigram
-- index sits on that column, so a recheck reads a string instead of
-- recomputing it. This changes NOTHING about the stored text: raw_text is
-- untouched, the column is derived and read-only, and content_hash still
-- hashes raw_text alone.
alter table corpus.hadiths
  add column if not exists raw_text_normalized text
  generated always as (corpus.normalize_ar(raw_text)) stored;

create index if not exists hadiths_raw_norm_trgm_idx
  on corpus.hadiths using gin (raw_text_normalized gin_trgm_ops);

drop index if exists corpus.hadiths_raw_trgm_idx;

analyze corpus.hadiths;
