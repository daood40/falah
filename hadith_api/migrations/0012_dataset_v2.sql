-- ============================================================
-- 0012 — JAMI-KAMIL-1437-V2: a correction release, not an edit
-- ============================================================
-- The pre-launch audit found two records in V1 whose text was a printed
-- ornament ("• • •" on ج11/ص195 and ج11/ص278), imported as if they were
-- narrations. They carry no Arabic letter at all, so they are not scripture and
-- never were: the parser took a separator line for a record.
--
-- Locked text is never edited or deleted in place, so the correction is a NEW
-- dataset version: V2 is imported from the same, byte-identical source files
-- with the corrected parser (an ornament line is no longer a record) and V1 is
-- marked superseded with its own fingerprint intact.
--
-- V2 therefore holds 15,959 records. Nothing else changed: every remaining
-- record's text, page, locator and hash are what V1 held.
insert into corpus.dataset_versions (version, source_id, description, is_active, released_at, status)
select 'JAMI-KAMIL-1437-V2', s.id,
       E'إصدار تصحيحي: أُسقطت سطرا زخرفة لا يحملان نصًا (ج11/ص195، ج11/ص278). '
       || E'لم يُعدَّل حرف واحد من نص أي حديث؛ نفس ملفات المصدر بنفس البصمات.',
       true, now(), 'draft'
from corpus.sources s where s.slug = 'ketabonline-62920'
on conflict (version) do nothing;

-- V1 is kept as provenance, with the fingerprint it was sealed under, so the
-- history of the corpus stays auditable even where its rows are not loaded.
update corpus.dataset_versions
   set is_active = false,
       status = 'superseded',
       record_count = coalesce(record_count, 15961),
       dataset_hash = coalesce(dataset_hash,
         '694a5afe4ac80aad4f3cd133ae1364160a3e23d6925774cd6f27868ecdb6cb7c')
 where version = 'JAMI-KAMIL-1437-V1';
