# PRIVATE_DOCUMENTATION — وضع المشروع الخاص

> **PRIVATE MODE: ON.** كل شيء داخلي. لا API عام، لا بيانات عامة، لا تنزيل عام،
> لا صوت عام، لا ترجمات عامة، لا تفسير عام — حتى يحصل المالك على كل التراخيص.

## 1. ما الموجود فعليًا اليوم

| المكوّن | الحالة | أين |
|---|---|---|
| قاعدة بيانات القرآن (مخطط `quran`) | 33 جدولًا + عرضان · RLS مفروض | `quran_api/migrations/001..003` |
| نص المصحف | 114 سورة · 6,236 آية · بصمة SHA-256 لكل آية | `quran.ayahs` |
| البنية | 30 جزءًا · 60 حزبًا · 240 ربعًا · 604 صفحات · 7 منازل · 15 سجدة | `quran.juzs/hizbs/pages/manzils` |
| الترجمات | 10 لغات × 6,236 = 62,360 سطرًا — **LICENSE_PENDING** | `quran.ayah_translations` |
| القراءات/الروايات | 1 قراءة (عاصم) · 1 رواية (حفص) | `quran.qiraat/riwayat` |
| القرّاء/التلاوات/الصوت | 0 — لا Dataset مرخّص، ولا بيانات وهمية | `quran.reciters/recitations/audio_files` |
| التفسير/الكلمات/الصرف/الموضوعات | جداول جاهزة وفارغة | `quran.tafsir_sources` … |
| الـAPI | 57 عملية للقراءة فقط · OpenAPI مطابق | `quran_api/` |
| مركز التراخيص | سجل لكل Dataset + بوابة | `quran.license_records` |
| الاعتماد البشري | جدول + trigger يمنع النشر بلا توقيع | `quran.human_verifications` |
| عميل Flutter | كامل + كاش يتحقق من البصمة | `flutter_app/lib/features/quran_api/` |

## 2. ما هو PRIVATE (كل شيء)

- **الـAPI**: يعمل على `127.0.0.1` افتراضيًا في الوضع الخاص، ويرفض أي وصول
  مجهول إلى المحتوى (451 + رسالة `PRIVATE_MODE`). الخادم **يرفض الإقلاع** أصلًا
  إذا حاول أحد تشغيل وضع عام بلا تراخيص.
- **البيانات**: في قاعدة بيانات خاصة، RLS مفروض على كل جدول، لا وصول مجهول.
- **التنزيل**: `/downloads/quran` يعيد `downloadable=false` بلا روابط.
- **التخزين**: لا buckets عامة — لم يُرفع أي ملف إلى أي تخزين.
- **PWA**: `noindex, nofollow` + `robots.txt` يمنع الفهرسة بالكامل.
- **Flutter**: لا رابط إنتاج داخل التطبيق؛ ملفا staging/production فارغان عمدًا.
- **owner_dropzone/**: خارج git بالكامل (عدا ملفات README).

## 3. ما يحتاج ترخيصًا قبل أي نشر

| المادة | الحالة | ما ينقص |
|---|---|---|
| نص المصحف | RESTRICTED | إذن إعادة توزيع صريح من مالك النص |
| الترجمات العشر | PENDING ×10 | إذن كل مترجم/ناشر |
| التفسير | UNKNOWN | لا يوجد Dataset بعد |
| الصوت | UNKNOWN | Dataset مرخّص + إذن إعادة توزيع/بث |
| القرّاء | UNKNOWN | Dataset مرخّص |
| بنية المصحف (quran-meta) | **CONFIRMED (MIT)** | — |
| القراءة/الرواية (بيانات وصفية) | **CONFIRMED (MIT)** | — |

التفاصيل والأدلة: `quran_api/reports/LICENSE_AUDIT.txt` و
`TRANSLATION_LICENSE_AUDIT.txt`، والسجل الحيّ في `quran.license_records`
(`npm run license:list`).

## 4. ما يحتاج اعتمادًا بشريًا

النسخة الحالية `2026.09.16-1` حالتها `verified` وليست `published`. ترقيتها
تتطلب سطر اعتماد بشري:

```bash
npm run verify:human -- --version=2026.09.16-1 --verifier="…" \
  --role="…" --scope="…" --sample=200 --result=approved
```

## 5. ما يمكن نشره بعد اكتمال التراخيص

بالترتيب، وبلا إعادة بناء:
1. إدخال أدلة التراخيص (`owner_dropzone/licenses/` + `npm run license:record`).
2. `npm run license:list` للتأكد أن كل نوع مطلوب صار CONFIRMED.
3. `npm run integrity:final` و`npm test`.
4. `npm run verify:human -- … --result=approved`.
5. رفع الأعلام في بيئة الخادم (PRIVATE_MODE=false + الأعلام المطلوبة).
6. `npm run release:gate` — لا نشر قبل ALLOWED.
7. النشر (Docker/أي مضيف Node 22) ثم وضع الرابط في
   `flutter_app/config/production.json`.

## 6. قواعد ثابتة لا تتغير بالتراخيص

- النص لا يُعدَّل أبدًا: `raw_text` محمي بـtrigger، وأي تصحيح = نسخة Dataset جديدة.
- لا ذكاء اصطناعي يولّد أو يصحّح نصًا شرعيًا أو ترجمة أو تفسيرًا.
- المجهول = NULL.
- لا تجاوز لأي حماية تقنية لأي مصدر.
- لا تُطبع نصوص المحتوى في السجلات، ولا أي سر.
