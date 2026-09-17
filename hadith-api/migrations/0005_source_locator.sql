-- ============================================================
-- FALAH — source locator for editions that carry no hadith numbering
-- «الجامع الكامل» has no serial hadith number in print, so the only honest
-- identity for a record is WHERE IT SITS IN THE SOURCE: volume / page /
-- position on that page. That is provenance, not an invented hadith number.
-- ============================================================

alter table corpus.hadiths
  add column source_locator text,          -- e.g. 'ج1/ص107/#1' — never shown as a hadith number
  add column source_ordinal int;           -- reading order inside the volume

comment on column corpus.hadiths.source_locator is
  'Position of the record in the printed source (volume/page/index). Used for idempotent re-import and ordering. NOT a hadith number.';

-- Re-importing the same volume must not duplicate the corpus (§37: nothing is
-- ever deleted, so the import must not create the duplicate in the first place).
create unique index hadiths_source_locator_unique
  on corpus.hadiths (dataset_version, edition_id, source_locator)
  where source_locator is not null;

-- Reading order for an edition without hadith numbers.
create index hadiths_reading_order_idx
  on corpus.hadiths (edition_id, volume_number, page_number, source_ordinal);
