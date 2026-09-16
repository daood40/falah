# TEST REPORT — FALAH Quran Data Platform

كل رقم هنا ناتج تشغيل فعلي في بيئة العمل بتاريخ 2026-09-16
(PostgreSQL 16.13 محلي، Node 22.22.2، Flutter 3.35.4 / Dart 3.9.2).

## 1. Database & migrations

```
psql -f supabase/migrations/0001_init.sql          PASS
psql -f supabase/migrations/0002_v2.sql            PASS
psql -f supabase/migrations/0003_quran_platform.sql PASS
schema quran: 31 جدولًا · RLS مفعّل + FORCE على 31 جدولًا
```

## 2. Import pipeline (تشغيل حقيقي)

```
node src/import/cli.ts --validate-only            status=success · 0 issues
node src/import/cli.ts --version=2026.09.16-1 \
     --translations=en,fr,tr,ur,id,es,ru,sv,bn,zh --publish

TOTAL SURAHS        114        IMPORTED    68,596
TOTAL AYAHS         6,236      FAILED      0
TOTAL JUZS          30         SKIPPED     0
TOTAL HIZBS         60         DUPLICATES  0
TOTAL RUBS          240        INVALID     0
TOTAL PAGES         604        MISSING     0
TOTAL MANZILS       7          VERIFIED    68,596
TOTAL SAJDAHS       15         ERRORS      0
TOTAL TRANSLATIONS  10         status      success
TOTAL AYAH_TRANSLATIONS 62,360
TOTAL RECITERS/RECITATIONS/AUDIO_FILES 0 (لا Dataset صوتي مرخّص)
```

التفاصيل الكاملة: `reports/import-report.json`.

## 3. Integrity report

```
node scripts/integrity-report.ts     PASS — 30/30 checks, 0 failed
```

يشمل: عدد السور والآيات والأجزاء والأحزاب والأرباع والصفحات والمنازل والسجدات،
غياب التكرار، غياب الفجوات في الترقيم العام، تطابق عدد آيات كل سورة، إعادة حساب
كل بصمة SHA-256 من النص المخزَّن ومقارنتها بالمصدر (6,236/6,236)، خرائط الجزء
والصفحة، تغطية الترجمات العشر (6,236 لكل ترجمة)، وسلامة ربط الصوت.
التفاصيل: `reports/integrity-report.json`.

## 4. API tests (vitest — قاعدة بيانات حقيقية، لا mocks)

```
tests/api.test.ts        26 tests   PASS
tests/security.test.ts   14 tests   PASS
tests/import.test.ts      9 tests   PASS
tests/unit.test.ts       12 tests   PASS
tests/audio.test.ts       4 tests   PASS
tests/openapi.test.ts     3 tests   PASS
------------------------------------------
Test Files 6 passed · Tests 68 passed (0 failed) · 3.4s
```

يغطي: الاستجابة الموحدة، الترقيم وحدوده (`limit=1000000` → 422)، معرّفات غير
صالحة، 404/405، حقن SQL في `q` والفلاتر، بحث فارغ، بوابة الترخيص (451)،
ترويسات الأمان، JWT (توقيع مزوّر/`alg:none`/انتهاء)، دورة حياة بيانات المستخدم،
عزل RLS بين مستخدمين على مستوى قاعدة البيانات نفسها، منع الكتابة على الجداول
العامة، مشغّل SOURCE_LOCK، وعقد OpenAPI مقابل الراوتر.

### جولة كسر (qa-engineer-mode) — 3 عيوب وُجدت وأُصلحت

| المحاولة | قبل | بعد |
|---|---|---|
| `GET /surahs/%2e%2e%2f%2e%2e` (مسار خبيث) | 500 (خطأ cast لـuuid) | 404 مع رسالة نظيفة |
| `POST /me/bookmarks` برمز مستخدم غير موجود | 500 (خرق مفتاح أجنبي) | 422 VALIDATION_ERROR |
| `HEAD /health` (فحوص المراقبة) | 405 | 200 بلا جسم |

أُضيفت اختبارات انحدار للثلاثة (`api.test.ts`, `security.test.ts`)، وأُضيف
تحويل مركزي لرموز أخطاء PostgreSQL (23503/23505/22P02/22003/42501) إلى
استجابات 4xx بلا تسريب تفاصيل داخلية.

## 5. OpenAPI

```
node scripts/validate-openapi.ts
OpenAPI OK — 48 paths, 54 operations, contract matches router.
```

## 6. Typecheck

```
tsc -p quran_api/tsconfig.json --noEmit        PASS (strict, 0 errors)
```

## 7. Flutter

```
flutter analyze                     No issues found! (11.7s)
flutter test                        46 tests passed (0 failed)
  ├─ test/quran_api_test.dart            10 passed (جديد)
  ├─ test/audio_player_service_test.dart  7 passed (جديد)
  └─ الاختبارات السابقة                  29 passed
```

## 8. ما لم يُختبر هنا ولماذا

- **التلاوات الصوتية**: المنفذ الخارجي في هذه البيئة يحجب
  `cdn.islamic.network` و`everyayah.com` و`api.alquran.cloud`
  (`connect_rejected` من البروكسي)، ولا حقوق إعادة توزيع مؤكدة. لذلك لم تُستورد
  أي ملفات صوتية حقيقية. خط الاستيراد والتحقق مختبَر بالكامل بمنفذ شبكة مزيّف
  (`tests/audio.test.ts`): ملف مفقود، نوع محتوى خاطئ، حجم مخالف، بصمة مخالفة.
- **النشر**: لم يُنشر أي خادم — `NOT DEPLOYED`.
