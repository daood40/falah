-- ============================================================
-- FALAH — data catalogue v2
--
-- Adds, per category: the source and its version, the dataset version, whether
-- the records carry checksums, their verification state and a note. Replaces
-- the v1 view in place; it is still computed from the data, so it cannot drift.
-- ============================================================

-- The column list changes, so the view is replaced rather than redefined.
drop view if exists quran.data_catalog;

create view quran.data_catalog as
with base as (
  select 'quran_text'::text as category, 'نص المصحف'::text as label,
         'ayahs'::text as table_name, 'quran_text'::text as license_kind,
         (select count(*) from quran.ayahs)::int as records,
         (select count(*) from quran.ayahs where verified)::int as verified,
         (select string_agg(distinct source_id, ', ') from quran.ayahs) as source_ids,
         (select string_agg(distinct dataset_version, ', ') from quran.ayahs) as dataset_versions,
         'sha256'::text as checksum_kind,
         (select count(*) from quran.ayahs where content_hash is not null)::int as with_checksum,
         'source-locked; hash recomputed on every verification run'::text as notes
  union all select 'surahs', 'السور', 'surahs', 'quran_text',
         (select count(*) from quran.surahs)::int,
         (select count(*) from quran.surahs where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.surahs),
         (select string_agg(distinct dataset_version, ', ') from quran.surahs),
         'none', 0, 'bismillah stays NULL: the source does not carry it'
  union all select 'juz', 'الأجزاء', 'juzs', 'metadata',
         (select count(*) from quran.juzs)::int,
         (select count(*) from quran.juzs where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.juzs), null,
         'none', 0, '29/30 boundaries agree with an independent reference'
  union all select 'hizb_quarters', 'الأحزاب والأرباع', 'hizbs', 'metadata',
         (select count(*) from quran.hizbs)::int,
         (select count(*) from quran.hizbs where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.hizbs), null,
         'none', 0, '240 quarters = 60 hizb'
  union all select 'pages', 'صفحات المصحف', 'pages', 'metadata',
         (select count(*) from quran.pages)::int,
         (select count(*) from quran.pages where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.pages), null,
         'none', 0, 'page scheme is declared in quran.data_schemes (PENDING owner decision)'
  union all select 'manzils', 'المنازل', 'manzils', 'metadata',
         (select count(*) from quran.manzils)::int,
         (select count(*) from quran.manzils where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.manzils), null,
         'none', 0, null
  union all select 'sajdahs', 'السجدات', 'ayahs.sajdah', 'metadata',
         (select count(*) from quran.ayahs where sajdah)::int,
         (select count(*) from quran.ayahs where sajdah and verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.ayahs where sajdah), null,
         'none', 0, 'sajdah scheme declared in quran.data_schemes (PENDING owner decision)'
  union all select 'qiraat', 'القراءات', 'qiraat', 'qiraat',
         (select count(*) from quran.qiraat)::int,
         (select count(*) from quran.qiraat where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.qiraat), null,
         'none', 0, null
  union all select 'riwayat', 'الروايات', 'riwayat', 'riwayat',
         (select count(*) from quran.riwayat)::int,
         (select count(*) from quran.riwayat where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.riwayat), null,
         'none', 0, null
  union all select 'translations', 'الترجمات (إصدارات)', 'translations', 'translation',
         (select count(*) from quran.translations)::int,
         (select count(*) from quran.translations where verified)::int,
         (select string_agg(distinct source_id, ', ') from quran.translations),
         (select string_agg(distinct version, ', ') from quran.translations),
         'none', 0, 'per-translator permission pending — see TRANSLATION_LICENSE_AUDIT.txt'
  union all select 'ayah_translations', 'الترجمات (أسطر)', 'ayah_translations', 'translation',
         (select count(*) from quran.ayah_translations)::int,
         (select count(*) from quran.ayah_translations where verified)::int,
         (select string_agg(distinct t.source_id, ', ') from quran.translations t), 
         (select string_agg(distinct dataset_version, ', ') from quran.ayah_translations),
         'sha256', (select count(*) from quran.ayah_translations where content_hash is not null)::int,
         'each line hashed and re-verified'
  union all select 'reciters', 'القرّاء', 'reciters', 'reciter',
         (select count(*) from quran.reciters)::int,
         (select count(*) from quran.reciters where verified)::int, null, null,
         'none', 0, 'empty on purpose: no licensed dataset supplied'
  union all select 'recitations', 'التلاوات', 'recitations', 'audio',
         (select count(*) from quran.recitations)::int,
         (select count(*) from quran.recitations where verified)::int, null, null,
         'none', 0, 'empty on purpose'
  union all select 'audio_files', 'الملفات الصوتية', 'audio_files', 'audio',
         (select count(*) from quran.audio_files)::int,
         (select count(*) from quran.audio_files where verified)::int, null,
         (select string_agg(distinct dataset_version, ', ') from quran.audio_files),
         'sha256', (select count(*) from quran.audio_files where checksum is not null)::int,
         'manifest schema enforced before any write'
  union all select 'tafsir_sources', 'مصادر التفسير', 'tafsir_sources', 'tafsir',
         (select count(*) from quran.tafsir_sources)::int,
         (select count(*) from quran.tafsir_sources where verified)::int, null, null,
         'none', 0, 'architecture ready, no data'
  union all select 'ayah_tafsirs', 'التفسير (أسطر)', 'ayah_tafsirs', 'tafsir',
         (select count(*) from quran.ayah_tafsirs)::int,
         (select count(*) from quran.ayah_tafsirs where verified)::int, null, null,
         'sha256', (select count(*) from quran.ayah_tafsirs where content_hash is not null)::int,
         'architecture ready, no data'
  union all select 'revelation_contexts', 'أسباب النزول', 'revelation_contexts', 'tafsir',
         (select count(*) from quran.revelation_contexts)::int,
         (select count(*) from quran.revelation_contexts where verified)::int, null, null,
         'sha256', (select count(*) from quran.revelation_contexts where content_hash is not null)::int,
         'architecture ready, no data'
  union all select 'ayah_words', 'الكلمات (كلمة بكلمة)', 'ayah_words', 'word_by_word',
         (select count(*) from quran.ayah_words)::int,
         (select count(*) from quran.ayah_words where verified)::int, null, null,
         'none', 0, 'architecture ready, no data'
  union all select 'topics', 'الموضوعات', 'topics', 'metadata',
         (select count(*) from quran.topics)::int,
         (select count(*) from quran.topics where verified)::int, null, null,
         'none', 0, 'no AI-generated classification is allowed'
  union all select 'ayah_topics', 'ربط الآيات بالموضوعات', 'ayah_topics', 'metadata',
         (select count(*) from quran.ayah_topics)::int,
         (select count(*) from quran.ayah_topics where verified)::int, null, null,
         'none', 0, null
  union all select 'editions', 'الإصدارات', 'quran_editions', 'quran_text',
         (select count(*) from quran.quran_editions)::int, null,
         (select string_agg(distinct source_id, ', ') from quran.quran_editions),
         (select string_agg(distinct version, ', ') from quran.quran_editions),
         'none', 0, null
  union all select 'dataset_versions', 'نسخ البيانات', 'quran_dataset_versions', 'metadata',
         (select count(*) from quran.quran_dataset_versions)::int,
         (select count(*) from quran.quran_dataset_versions where status in ('verified','published'))::int,
         (select string_agg(distinct source_id, ', ') from quran.quran_dataset_versions),
         (select string_agg(distinct version, ', ') from quran.quran_dataset_versions),
         'sha256', (select count(*) from quran.quran_dataset_versions where source_file_hash is not null)::int,
         'immutable: a change means a new version'
  union all select 'sources', 'المصادر', 'sources', 'software',
         (select count(*) from quran.sources)::int,
         (select count(*) from quran.sources where status = 'approved')::int,
         (select string_agg(id, ', ') from quran.sources),
         (select string_agg(distinct version, ', ') from quran.sources),
         'none', 0, null
  union all select 'data_schemes', 'الأنظمة المعلنة', 'data_schemes', 'metadata',
         (select count(*) from quran.data_schemes)::int,
         (select count(*) from quran.data_schemes where decision_status = 'CONFIRMED')::int,
         (select string_agg(distinct source_id, ', ') from quran.data_schemes),
         (select string_agg(distinct dataset_version, ', ') from quran.data_schemes),
         'none', 0, 'sajdah and page schemes await the owner decision'
  union all select 'human_verifications', 'الاعتماد البشري', 'human_verifications', 'metadata',
         (select count(*) from quran.human_verifications)::int,
         (select count(*) from quran.human_verifications where result = 'approved')::int,
         null, null, 'none', 0, 'automated verification is not human verification'
)
select
  b.category,
  b.label,
  b.table_name,
  b.records,
  b.verified,
  b.source_ids as source,
  s.source_version,
  b.dataset_versions as dataset_version,
  b.license_kind,
  coalesce(l.status, 'UNKNOWN') as license_status,
  coalesce(l.confirmed, 0) as license_records_confirmed,
  coalesce(l.total, 0) as license_records_total,
  case
    when b.checksum_kind = 'none' then 'not_applicable'
    when b.records = 0 then 'not_applicable'
    when b.with_checksum = b.records then 'complete'
    else 'partial'
  end as checksum_status,
  case
    when b.records = 0 then 'empty'
    when b.verified is null then 'not_applicable'
    when b.verified = b.records then 'automated_verified'
    when b.verified = 0 then 'unverified'
    else 'partial'
  end as verification_status,
  case
    when b.records = 0 then 'empty'
    when coalesce(l.status, 'UNKNOWN') <> 'CONFIRMED' then 'private_pending_license'
    when b.verified is not null and b.verified < b.records then 'private_pending_license'
    when b.checksum_kind <> 'none' and b.with_checksum < b.records then 'private_pending_license'
    else 'ready'
  end as availability,
  b.notes
from base b
left join lateral (
  select
    case
      when bool_and(status = 'CONFIRMED') then 'CONFIRMED'
      when bool_or(status = 'REJECTED') then 'REJECTED'
      when bool_or(status = 'RESTRICTED') then 'RESTRICTED'
      when bool_or(status = 'PENDING') then 'PENDING'
      else 'UNKNOWN'
    end as status,
    count(*) filter (where status = 'CONFIRMED')::int as confirmed,
    count(*)::int as total
  from quran.license_records where dataset_kind = b.license_kind
) l on true
left join lateral (
  select string_agg(distinct src.version, ', ') as source_version
  from quran.sources src
  where b.source_ids is not null and position(src.id in b.source_ids) > 0
) s on true;

grant select on quran.data_catalog to authenticated, service_role;
