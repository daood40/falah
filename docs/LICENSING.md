# LICENSING — مركز التراخيص وقواعده

## القاعدة الحاكمة

وجود الملف على الإنترنت **ليس** إذنًا بإعادة توزيعه. ترخيص الحزمة **ليس** ترخيص
النص الذي بداخلها. نجاح الاختبارات **ليس** ترخيصًا. لا يُعتمد ترخيص إلا بدليل.

## الفصل بين خمسة تراخيص

| النوع | ماذا يغطي | مثال |
|---|---|---|
| Software | التغليف والكود | `quran-json` package |
| Quran text | نص المصحف نفسه | quranenc.com (مصدر النص) |
| Translation | عمل المترجم | Saheeh International, Diyanet … |
| Audio / Reciter | التلاوة وحقوق القارئ/الناشر | — |
| Metadata | الأرقام والحدود | `quran-meta` (MIT) |

## الحالات

`UNKNOWN` → لا نعرف · `PENDING` → بانتظار إذن · `RESTRICTED` → موجود داخليًا ولا
يُنشر · `CONFIRMED` → إذن موثّق بدليل · `REJECTED` → مرفوض صراحة.

`CONFIRMED` مستحيل بلا `evidence` وبلا إجابة صريحة عن إعادة التوزيع — قاعدة
البيانات ترفض السطر (`LICENSE_EVIDENCE_REQUIRED`).

## الحقول المسجَّلة لكل Dataset

`dataset_kind · subject · source · owner · copyright_holder · license ·
license_url · permission_reference · redistribution · commercial_use ·
modification · attribution_required · attribution_text · expires_at ·
evidence · evidence_url · status · recorded_by · notes`

## الأوامر

```bash
npm run license:list                  # الحالة الحالية + الملخّص
npm run license:record -- --kind=… --subject=… --status=… --evidence=…
npm run release:gate                  # هل يُسمح بالنشر العام؟
GET /api/v1/licenses                  # نفس السجل عبر الـAPI (يتطلب مصادقة)
```

## الحالة اليوم

| النوع | CONFIRMED | غير مؤكد |
|---|---|---|
| metadata · qiraat · riwayat · software(quran-meta) | ✅ MIT بدليل مقروء من القرص | — |
| quran_text | ❌ | RESTRICTED — تضارب ترخيص + لا إذن من مالك النص |
| translation ×10 | ❌ | PENDING — لا إذن من المترجمين |
| audio · reciter · tafsir · word_by_word · morphology · tajweed | ❌ | UNKNOWN — لا Dataset |

## ما الذي يفتح النشر

`PRIVATE_MODE=false` **و** `PUBLIC_DATA_ENABLED` **و** `PUBLIC_API_ENABLED`
**و** `DATA_REDISTRIBUTION_ALLOWED` **و** `CONTENT_LICENSE_CONFIRMED` **و**
`TRANSLATIONS_LICENSE_CONFIRMED` (**و** `AUDIO_LICENSE_CONFIRMED` إن كان الصوت
ضمن الإصدار) **و** كل أنواع License Center المطلوبة CONFIRMED **و** اعتماد بشري
approved **و** التكامل PASS **و** الاختبارات PASS. أي شرط ناقص ⇒ `BLOCKED`.
