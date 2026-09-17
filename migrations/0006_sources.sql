-- ============================================================
-- FALAH — record where the imported text actually came from.
-- The owner supplied a Shamela export of the printed edition; ketabonline
-- stays registered as the digital reference the project started from, but the
-- edition must point at the source its text was really taken from.
-- ============================================================

insert into corpus.sources (slug, name, description, url, publisher, country, language, source_type, license_status)
values (
  'shamela-47',
  E'المكتبة الشاملة — الجامع الكامل في الحديث الصحيح الشامل',
  E'نسخة نصية من الطبعة المطبوعة قدّمها صاحب المشروع؛ ترقيم الصفحات موافق للمطبوع. الحقوق غير مؤكدة.',
  'https://shamela.ws/book/47',
  E'دار السلام للنشر والتوزيع – الرياض',
  'SA', 'ar', 'website', 'unconfirmed'
) on conflict (slug) do nothing;

update corpus.editions e
   set source_id = s.id
  from corpus.sources s
 where e.slug = 'jami-kamil-1437'
   and s.slug = 'shamela-47';
