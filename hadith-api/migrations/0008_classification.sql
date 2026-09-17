-- ============================================================
-- FALAH Hadith API — classification surfaces
-- Everything the corpus can be browsed BY, each as its own resource:
-- collections cited in takhrij, grading labels, volumes/pages, and the
-- book→chapter catalogue. Counts only — no scripture leaves these views.
-- ============================================================

-- ---------- collections named in takhrij (§13) ----------
create or replace view corpus.collections_view as
select
  hs.source_name                                     as name,
  count(distinct hs.hadith_id)                       as hadith_count,
  count(distinct h.book_id)                          as book_count,
  min(h.volume_number)                               as first_volume,
  max(h.volume_number)                               as last_volume,
  count(distinct hs.hadith_id) filter (where c.verdict = 'corroborated') as corroborated_count
from corpus.hadith_sources hs
join corpus.hadiths h on h.id = hs.hadith_id
left join corpus.cross_checks c on c.hadith_id = hs.hadith_id
group by hs.source_name;

-- ---------- grading labels, exactly as printed ----------
create or replace view corpus.gradings_view as
select
  h.grading                                          as label,
  count(*)                                           as hadith_count,
  count(distinct h.book_id)                          as book_count,
  min(g.grader)                                      as grader,
  count(*) filter (where h.verified)                 as verified_count
from corpus.hadiths h
left join corpus.hadith_gradings g on g.hadith_id = h.id
where h.grading is not null
group by h.grading;

-- ---------- volumes and their printed page range ----------
create or replace view corpus.volumes_view as
select
  h.edition_id,
  h.volume_number                                    as volume,
  count(*)                                           as hadith_count,
  min(h.page_number)                                 as first_page,
  max(h.page_number)                                 as last_page,
  count(distinct h.page_number)                      as pages_with_text,
  count(distinct h.book_id)                          as book_count
from corpus.hadiths h
where h.volume_number is not null
group by h.edition_id, h.volume_number;

-- ---------- the browsing catalogue: book → chapters → counts ----------
-- Scalar sub-selects, not joins: joining books × chapters × hadiths multiplies
-- the rows before it aggregates them (measured 2.8 s → 30 ms).
drop view if exists corpus.catalog_view;
create view corpus.catalog_view as
select
  b.edition_id,
  b.id                                               as book_id,
  b.name                                             as book_name,
  b.order_number                                     as book_order,
  (select count(*) from corpus.chapters c where c.book_id = b.id)        as chapter_count,
  agg.hadith_count,
  agg.first_volume,
  agg.last_volume
from corpus.books b
left join lateral (
  select count(*) as hadith_count,
         min(h.volume_number) as first_volume,
         max(h.volume_number) as last_volume
  from corpus.hadiths h where h.book_id = b.id
) agg on true;

grant select on corpus.collections_view, corpus.gradings_view,
                corpus.volumes_view, corpus.catalog_view
  to anon, authenticated;
