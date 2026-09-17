-- ============================================================
-- FALAH Hadith API — dataset identity and per-record verification state
--
-- A client must be able to ask one question and get a stable answer:
-- "which dataset am I holding, and has it changed?" That is a version, a
-- record count and one SHA-256 over the whole corpus.
-- ============================================================

alter table corpus.dataset_versions
  add column dataset_hash text,               -- sha256 over every record hash, in order
  add column record_count int,
  add column status text not null default 'draft'
    check (status in ('draft', 'sealed', 'superseded'));

comment on column corpus.dataset_versions.dataset_hash is
  'SHA-256 of every content_hash in this dataset, ordered — changes if any record changes, is added or is removed.';

/**
 * Computed, never typed in: the fingerprint of the whole dataset.
 */
create or replace function corpus.compute_dataset_hash(p_version text)
returns text language sql stable as $$
  select encode(
           digest(
             coalesce(string_agg(h.content_hash, ':' order by h.content_hash), ''),
             'sha256'),
           'hex')
  from corpus.hadiths h
  where h.dataset_version = p_version
$$;

/**
 * Seals a dataset: records its fingerprint and size as of now. Re-sealing after
 * an import updates both; the hash changing is exactly the signal a client
 * needs to invalidate its cache.
 */
create or replace function corpus.seal_dataset(p_version text)
returns table (version text, dataset_hash text, record_count int, status text)
language plpgsql as $$
begin
  return query
  update corpus.dataset_versions d
     set dataset_hash = corpus.compute_dataset_hash(p_version),
         record_count = (select count(*) from corpus.hadiths h where h.dataset_version = p_version),
         status = 'sealed',
         updated_at = now()
   where d.version = p_version
  returning d.version, d.dataset_hash, d.record_count, d.status;
end $$;

/**
 * The three verification layers, per record, as one row — read by
 * GET /api/v1/hadiths/{id}/verification.
 *   source_match : the stored text still matches the file it was imported from
 *   cross_check  : what an independent corpus says
 *   human_review : a human compared this record against the printed edition
 *   verified     : the hadith's own flag, which only a human check can set
 */
create or replace view corpus.verification_state as
select
  h.id                                        as hadith_id,
  h.verified,
  h.verification_status,
  h.content_hash,
  h.dataset_version,
  exists (
    select 1 from corpus.verification_records v
    where v.hadith_id = h.id and v.verification_type = 'structural'
      and v.result = 'passed' and v.content_hash = h.content_hash
  )                                           as source_match,
  coalesce(
    (select case c.verdict
              when 'corroborated' then 'SUPPORTED'
              when 'partial'      then 'PARTIAL'
              else 'NOT_FOUND'
            end
     from corpus.cross_checks c
     where c.hadith_id = h.id
     order by c.similarity desc limit 1),
    'UNKNOWN')                                as cross_check,
  (select c.similarity from corpus.cross_checks c
    where c.hadith_id = h.id order by c.similarity desc limit 1) as cross_check_similarity,
  (select c.reference_collection from corpus.cross_checks c
    where c.hadith_id = h.id order by c.similarity desc limit 1) as cross_check_collection,
  exists (
    select 1 from corpus.verification_records v
    where v.hadith_id = h.id and v.result = 'passed'
      and v.verification_type in ('manual_sample', 'external_source')
  )                                           as human_review
from corpus.hadiths h;

grant select on corpus.verification_state to anon, authenticated;
