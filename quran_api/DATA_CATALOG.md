# DATA CATALOG — كل ما تحويه المنصة، مصنَّفًا

الجدول الحيّ لهذا الملف هو `GET /api/v1/catalog` (يتطلب مصادقة) وخلفه العرض
`quran.data_catalog` — لا يمكن أن يتأخّر عن البيانات لأنه محسوب منها.

الأرقام أدناه من تشغيل فعلي بتاريخ 2026-09-17.

## 1. نص المصحف

| الفئة | السجلات | مُتحقَّق | المصدر | الترخيص | الإتاحة |
|---|---|---|---|---|---|
| الآيات `ayahs` | 6,236 | 6,236 | quran-json (نصه من quranenc.com) | RESTRICTED | خاص حتى الترخيص |
| السور `surahs` | 114 | 114 | quran-json | RESTRICTED | خاص حتى الترخيص |
| الإصدارات `quran_editions` | 1 (حفص عثماني) | — | quran-json | RESTRICTED | خاص حتى الترخيص |

لكل آية: النص الحرفي · بصمة SHA-256 · رقم عالمي · جزء/حزب/ربع/صفحة/منزل/ركوع ·
علم السجدة · نسخة Dataset · مصدر · حالة تحقق · `source_locked`.

## 2. بنية المصحف (ترخيص مؤكد — MIT)

| الفئة | السجلات | المصدر | الترخيص |
|---|---|---|---|
| الأجزاء `juzs` | 30 | quran-meta | CONFIRMED |
| الأحزاب والأرباع `hizbs` | 240 ربعًا (60 حزبًا) | quran-meta | CONFIRMED |
| الصفحات `pages` | 604 | quran-meta | CONFIRMED |
| المنازل `manzils` | 7 | quran-meta | CONFIRMED |
| السجدات (علم على الآية) | 15 | quran-meta | CONFIRMED |

## 3. القراءات والروايات

| الفئة | السجلات | المصدر | الترخيص |
|---|---|---|---|
| القراءات `qiraat` | 1 — عاصم | quran-meta | CONFIRMED |
| الروايات `riwayat` | 1 — حفص عن عاصم | quran-meta | CONFIRMED |

قراءة ≠ رواية ≠ قارئ: ثلاثة كيانات منفصلة بجداول منفصلة وعلاقات صريحة.

## 4. الترجمات (كلها LICENSE_PENDING)

10 إصدارات × 6,236 = **62,360 سطرًا**، لكل سطر بصمته:

| slug | اللغة | المترجم |
|---|---|---|
| en-saheeh | الإنجليزية | Saheeh International |
| fr-hamidullah | الفرنسية | Muhammad Hamidullah |
| tr-diyanet | التركية | Diyanet İşleri |
| ur-maududi | الأردية | أبو الأعلى المودودي |
| id-affairs | الإندونيسية | Kementerian Agama |
| es-garcia | الإسبانية | Muhammad Isa García |
| ru-kuliev | الروسية | Elmir Kuliev |
| sv-bernstrom | السويدية | Knut Bernström |
| bn-khan | البنغالية | Muhiuddin Khan |
| zh-makin | الصينية | Ma Jian |

## 5. الصوت والقرّاء — فارغة عمدًا

| الفئة | السجلات | السبب |
|---|---|---|
| القرّاء `reciters` | 0 | لا Dataset مرخّص |
| التلاوات `recitations` | 0 | لا Dataset مرخّص |
| الملفات الصوتية `audio_files` | 0 | لا Dataset مرخّص + CDN محجوب |

البنية والاستيراد والتحقق جاهزة: `schemas/audio-manifest.schema.json` يرفض أي
manifest ناقص قبل أي كتابة، والتحقق يفحص الرابط والنوع والحجم والبصمة.

## 6. بنية جاهزة بلا بيانات

| الفئة | الجدول | ما ينقص |
|---|---|---|
| التفسير | `tafsir_sources` · `ayah_tafsirs` | Dataset مرخّص |
| أسباب النزول | `revelation_contexts` | Dataset مرخّص |
| كلمة بكلمة | `ayah_words` | Dataset مرخّص |
| الجذر/اللفظ/الصرف | أعمدة `ayah_words` | Dataset مرخّص |
| الموضوعات | `topics` · `ayah_topics` | مصدر موثوق أو مراجعة بشرية |
| التجويد | — | يُصمَّم عند وصول Dataset حقيقي، لا قبله |

## 7. بيانات المستخدم (خاصة بكل مستخدم عبر RLS)

`user_bookmarks` · `user_favorites` · `user_reading_progress` ·
`user_favorite_reciters` · `user_audio_progress` · `user_quran_settings`

## 8. الحوكمة

| الفئة | الجدول | الدور |
|---|---|---|
| المصادر | `sources` | سجل المصدر والترخيص والنسبة |
| نسخ البيانات | `quran_dataset_versions` | نسخة + بصمة الملف + الحالة |
| مركز التراخيص | `license_records` | لا CONFIRMED بلا دليل |
| الاعتماد البشري | `human_verifications` | لا نشر بلا توقيع شخص |
| سجل التدقيق | `audit_logs` | كل استيراد/اعتماد/تسجيل ترخيص |

## 9. حالة الإتاحة

- `ready` — الترخيص مؤكد (بنية المصحف، القراءة، الرواية).
- `private_pending_license` — البيانات موجودة داخليًا ولا تُنشر (النص، الترجمات).
- `empty` — لا بيانات أصلًا (الصوت، القرّاء، التفسير، الكلمات).

## 10. التحقق من الصحة

`npm run verify:cross` يقارن كل شيء بمصادر مستقلة ويكتب
`reports/CROSS_SOURCE_VERIFICATION.txt`. آخر نتيجة: تطابق **6,236/6,236** حرفيًا
مع إصدار حفص مستقل، و**114/114** في بيانات السور مقابل مرجعين، و**604/604** في
حدود الصفحات. الفروق المتبقية موثّقة ومُحكَّمة في التقرير ولم يُغيَّر بسببها حرف.
