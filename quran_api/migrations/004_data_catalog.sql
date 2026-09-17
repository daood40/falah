-- ============================================================
-- FALAH — data catalogue
--
-- One row per data category: what it is, which table holds it, how many
-- records exist, how many are verified, which licence kind governs it and what
-- that licence's current status is. It is a view, so it can never drift from
-- the data it describes.
-- ============================================================

create or replace view quran.data_catalog as
with categories as (
  select 'quran_text'::text as category, 'نص المصحف'::text as label,
         'ayahs'::text as table_name, 'quran_text'::text as license_kind,
         (select count(*) from quran.ayahs) as records,
         (select count(*) from quran.ayahs where verified) as verified
  union all select 'surahs', 'السور', 'surahs', 'quran_text',
         (select count(*) from quran.surahs),
         (select count(*) from quran.surahs where verified)
  union all select 'juz', 'الأجزاء', 'juzs', 'metadata',
         (select count(*) from quran.juzs),
         (select count(*) from quran.juzs where verified)
  union all select 'hizb_quarters', 'الأحزاب والأرباع', 'hizbs', 'metadata',
         (select count(*) from quran.hizbs),
         (select count(*) from quran.hizbs where verified)
  union all select 'pages', 'صفحات المصحف', 'pages', 'metadata',
         (select count(*) from quran.pages),
         (select count(*) from quran.pages where verified)
  union all select 'manzils', 'المنازل', 'manzils', 'metadata',
         (select count(*) from quran.manzils),
         (select count(*) from quran.manzils where verified)
  union all select 'sajdahs', 'السجدات', 'ayahs.sajdah', 'metadata',
         (select count(*) from quran.ayahs where sajdah),
         (select count(*) from quran.ayahs where sajdah and verified)
  union all select 'qiraat', 'القراءات', 'qiraat', 'qiraat',
         (select count(*) from quran.qiraat),
         (select count(*) from quran.qiraat where verified)
  union all select 'riwayat', 'الروايات', 'riwayat', 'riwayat',
         (select count(*) from quran.riwayat),
         (select count(*) from quran.riwayat where verified)
  union all select 'translations', 'الترجمات (إصدارات)', 'translations', 'translation',
         (select count(*) from quran.translations),
         (select count(*) from quran.translations where verified)
  union all select 'ayah_translations', 'الترجمات (أسطر)', 'ayah_translations', 'translation',
         (select count(*) from quran.ayah_translations),
         (select count(*) from quran.ayah_translations where verified)
  union all select 'reciters', 'القرّاء', 'reciters', 'reciter',
         (select count(*) from quran.reciters),
         (select count(*) from quran.reciters where verified)
  union all select 'recitations', 'التلاوات', 'recitations', 'audio',
         (select count(*) from quran.recitations),
         (select count(*) from quran.recitations where verified)
  union all select 'audio_files', 'الملفات الصوتية', 'audio_files', 'audio',
         (select count(*) from quran.audio_files),
         (select count(*) from quran.audio_files where verified)
  union all select 'tafsir_sources', 'مصادر التفسير', 'tafsir_sources', 'tafsir',
         (select count(*) from quran.tafsir_sources),
         (select count(*) from quran.tafsir_sources where verified)
  union all select 'ayah_tafsirs', 'التفسير (أسطر)', 'ayah_tafsirs', 'tafsir',
         (select count(*) from quran.ayah_tafsirs),
         (select count(*) from quran.ayah_tafsirs where verified)
  union all select 'revelation_contexts', 'أسباب النزول', 'revelation_contexts', 'tafsir',
         (select count(*) from quran.revelation_contexts),
         (select count(*) from quran.revelation_contexts where verified)
  union all select 'ayah_words', 'الكلمات (كلمة بكلمة)', 'ayah_words', 'word_by_word',
         (select count(*) from quran.ayah_words),
         (select count(*) from quran.ayah_words where verified)
  union all select 'topics', 'الموضوعات', 'topics', 'metadata',
         (select count(*) from quran.topics),
         (select count(*) from quran.topics where verified)
  union all select 'ayah_topics', 'ربط الآيات بالموضوعات', 'ayah_topics', 'metadata',
         (select count(*) from quran.ayah_topics),
         (select count(*) from quran.ayah_topics where verified)
  union all select 'editions', 'الإصدارات', 'quran_editions', 'quran_text',
         (select count(*) from quran.quran_editions), null
  union all select 'dataset_versions', 'نسخ البيانات', 'quran_dataset_versions', 'metadata',
         (select count(*) from quran.quran_dataset_versions),
         (select count(*) from quran.quran_dataset_versions where status in ('verified', 'published'))
  union all select 'sources', 'المصادر', 'sources', 'software',
         (select count(*) from quran.sources),
         (select count(*) from quran.sources where status = 'approved')
  union all select 'human_verifications', 'الاعتماد البشري', 'human_verifications', 'metadata',
         (select count(*) from quran.human_verifications),
         (select count(*) from quran.human_verifications where result = 'approved')
)
select
  c.category,
  c.label,
  c.table_name,
  -- counts are cast to int so clients get numbers, not bigint strings
  c.records::int as records,
  c.verified::int as verified,
  c.license_kind,
  coalesce(l.status, 'UNKNOWN') as license_status,
  coalesce(l.confirmed, 0) as license_records_confirmed,
  coalesce(l.total, 0) as license_records_total,
  case
    when c.records = 0 then 'empty'
    when coalesce(l.status, 'UNKNOWN') = 'CONFIRMED' then 'ready'
    else 'private_pending_license'
  end as availability
from categories c
left join lateral (
  select
    -- the weakest status of that kind decides
    case
      when bool_and(status = 'CONFIRMED') then 'CONFIRMED'
      when bool_or(status = 'REJECTED') then 'REJECTED'
      when bool_or(status = 'RESTRICTED') then 'RESTRICTED'
      when bool_or(status = 'PENDING') then 'PENDING'
      else 'UNKNOWN'
    end as status,
    count(*) filter (where status = 'CONFIRMED')::int as confirmed,
    count(*)::int as total
  from quran.license_records where dataset_kind = c.license_kind
) l on true;

grant select on quran.data_catalog to authenticated, service_role;
