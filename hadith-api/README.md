# FALAH Hadith API

خدمة مستقلة: REST API فوق مجموعة أحاديث مُستوردة ومُتحقَّق منها، على PostgreSQL.
لا تعتمد على بقية هذا المستودع — انسخ مجلد `hadith-api/` وحده واستعملها في أي مشروع.

المحتوى الحالي: **الجامع الكامل في الحديث الصحيح الشامل**
(أبو أحمد محمد عبد الله الأعظمي «الضياء» — ط1، دار السلام، ١٤٣٧هـ/٢٠١٦م، 12 مجلدًا)
**15,961 حديثًا** · 67 كتابًا · 5,338 بابًا · 1,643 راويًا · 29,146 رابط تخريج.

> **الترخيص غير مؤكد** ⇒ `CONTENT_LICENSE_CONFIRMED=false`: الـAPI العام يُرجع
> `raw_text/matn/isnad/takhrij = null` مع `text_available:false`، وملفات المصدر في
> `data/` خارج git. التفاصيل: `reports/CONTENT_LICENSE.txt`.

## تشغيل في دقيقة

```bash
# أ) بالحاويات — قاعدة بيانات + API جاهزان
docker compose up -d
curl localhost:8787/api/v1/health

# ب) محليًا على Postgres موجود
npm ci
export DATABASE_URL=postgresql://user:pass@localhost:5432/hadith
for f in migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
npm run import -- --file data/jami-kamil-j01.txt --adapter jami_kamil_shamela \
  --edition jami-kamil-1437 --dry-run          # فحص بلا كتابة
bash scripts/import-jami-kamil.sh              # الاستيراد الكامل (46 ثانية)
npm run dev
```

الخدمة تصف نفسها: `GET /` يسرد الموارد، و`GET /openapi.yaml` يُرجع المواصفة
كاملة (OpenAPI 3.1) — يكفي أي مُستهلِك بلا وصول للمستودع.

## الموارد

عقد Falah الرسمي في `FALAH_INTEGRATION.md` (15 موردًا). الجدول الكامل:

| المورد | المسار | ماذا يعطي |
|---|---|---|
| الأحاديث | `/api/v1/hadiths` · `/{id}` · `/by-number/{n}` | قائمة مختصرة، وتفصيل قياسي |
| عشوائي/يومي | `/api/v1/hadiths/random` · `/daily` | سجل موجود فعلًا؛ واليومي حتمي |
| أجزاء الحديث | `/api/v1/hadiths/{id}/{narrators\|references\|takhrij\|gradings\|verification}` | أو `?include=` على التفصيل |
| هوية المجموعة | `/api/v1/version` · `/datasets` | الإصدار والبصمة وعدد السجلات |
| البحث | `/api/v1/search?q=` | بحث عربي (FTS + trgm) بلا حساسية للتشكيل والهمزات |
| الفهرس | `/api/v1/catalog?chapters=true` | شجرة الكتب والأبواب في نداء واحد |
| الكتب/الأبواب | `/api/v1/books` · `/chapters` (+ `/{id}/hadiths`) | التصفّح الهرمي |
| الرواة | `/api/v1/narrators` (+ `/{id}/hadiths`) | 1,643 راويًا مستخرجين حرفيًا |
| **التخريج** | `/api/v1/collections` (+ `/{name}/hadiths`) | 26 كتابًا مُخرَّجًا إليه مع العدد ونسبة التأييد |
| **الدرجات** | `/api/v1/gradings` | تصنيف الدرجات كما طُبعت وعدد كلٍّ |
| **المجلدات** | `/api/v1/volumes` (+ `/{n}/hadiths`) | المجلدات ونطاق صفحاتها وترتيب القراءة |
| **المقارنة** | `/api/v1/cross-checks/summary` · `/hadiths/{id}/cross-checks` · `/cross-checks/review-queue` | ما تقوله مصادر مستقلة عن كل سجل |
| الطبعات/المصادر | `/api/v1/editions` · `/sources` · `/references` | بيانات النشر والحقوق |
| النظام | `/api/v1/health` · `/stats` | حالة حيّة وأرقام حقيقية |
| الإدارة | `/api/v1/admin/*` (Bearer) | استيراد، تحقق، عيّنات بشرية، تدقيق |

الاستجابة موحّدة: `{ success, data, meta }` أو `{ success, error:{ code, message } }`.
الترقيم `?page=&limit=` بسقف صارم (100) — الطلب الأكبر يُرفض بـ422 لا يُقصّ بصمت.

## عملاء جاهزون

* Dart/Flutter: `clients/dart/` — حزمة `falah_hadith_api` **العميل الرسمي لـFalah**:
  نماذج مكتوبة الأنواع (‏`Hadith`, `HadithSummary`, `Takhrij`, `Grading`,
  `Verification`, `DatasetVersion`…) و24 دالة تغطي كل موارد العقد.
  دليل الربط: `FALAH_INTEGRATION.md`.
* TypeScript/JS: `clients/typescript/falah-hadith.ts` — ملف واحد بلا تبعيات.

## موثوقية البيانات — ثلاث طبقات

1. **مطابقة المصدر** (`npm run sample-verify`): كل سجل من الـ15,961 يُعاد قياسه
   مقابل ملف المصدر: النص حرفيًا، والصفحة المُعلنة، وبصمة SHA-256 — 15961/15961.
2. **قواعد السلامة** (`npm run verify`): 21 قاعدة على قاعدة البيانات، وكل قاعدة
   يثبت اختبارٌ أنها تلتقط مخالفة مزروعة (لا قاعدة صورية).
3. **المقارنة بمصدر مستقل** (`npm run cross-verify`): مقابل مجموعة منشورة منفصلة
   (16 مجموعة، ~47 ألف حديث) بمطابقة نوافذ كلمات؛ النتيجة تُحفظ في
   `corpus.cross_checks` وتُعرض في الـAPI. **لا تعديل لأي نص أبدًا**: ما لا يؤيَّد
   يذهب إلى `review-queue` لمراجعة بشرية.

`verified = true` لا يحدث إلا بعيّنة تحقق **بشرية** عبر
`POST /api/v1/admin/verification-samples`. حتى اللحظة: 0 عيّنة بشرية ⇒ الحقل
`verified=false` على كل السجلات، وهذا مقصود.

## SOURCE_LOCK

* `content_hash` عمود مولَّد = `sha256(raw_text)` — لا يكتبه أحد يدويًا.
* مشغّلات ترفض تعديل أو حذف أي نص `source_locked`، حتى من المسار الإداري.
* التصحيح = **مجموعة بيانات جديدة** (`dataset_version`)، لا تعديل للتاريخي.
* لا اختراع: ما لا يذكره المصدر يبقى `NULL` (هذه الطبعة بلا ترقيم أحاديث، ولا
  تفصل متنًا عن سند ⇒ الحقول الثلاثة `NULL` في كل السجلات).

## إضافة مصدر/كتاب آخر

محوِّل واحد في `src/importer/adapters/` يكفي: الجداول والـAPI لا تتغير.
الموجود: `jami_kamil_shamela` (نصّ الشاملة) · `jami_kamil` (عقد JSON) ·
`generic_json` · `generic_csv` · `generic_html`. العقد في `contracts/`.

## متغيرات البيئة

`DATABASE_URL` · `CONTENT_LICENSE_CONFIRMED` · `ADMIN_API_KEY` ·
`SUPABASE_JWT_SECRET` · `CORS_ORIGINS` · `MAX_PAGE_LIMIT` · `RATE_LIMIT_*` ·
`PORT` — القالب الكامل في `.env.example`. لا مفتاح خدمة في أي عميل.

## الاختبارات

```bash
npm run db:reset && npm test    # 183 اختبارًا على PostgreSQL حقيقي
npm run typecheck
npm run verify                  # سلامة البيانات (21 قاعدة)
npm run cross-verify            # المقارنة بالمصدر المستقل
npm run smoke                   # نداء فعلي لكل نقطة نهاية
```

التقارير الفعلية (أرقام لا ادّعاءات) في `reports/`.
