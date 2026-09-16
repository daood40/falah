# FALAH Hadith API

Backend + REST API لبيانات كتب الحديث، مبني أولًا حول:

> **الجامع الكامل في الحديث الصحيح الشامل**
> المؤلف: محمد عبد الله الأعظمي المعروف بالضياء · الطبعة الأولى 1437هـ / 2016م
> 12 مجلدًا · دار السلام للنشر والتوزيع – الرياض
> المصدر الرقمي المرجعي: https://ketabonline.com/ar/books/62920

التصميم متعدّد المصادر منذ اليوم الأول: `sources → editions → books → chapters → hadiths`،
فإضافة البخاري أو مسلم لاحقًا لا تتطلب تغيير المخطط ولا الـAPI.

> **حالة البيانات الآن:** الطبعة مستوردة كاملة — **15,961 حديثًا** في 67 كتابًا
> و5,338 بابًا و1,643 راويًا، من 12 ملفًا قدّمها صاحب المشروع (تصدير الشاملة
> للطبعة المطبوعة). كل سجل تُحقّق منه آليًا مقابل ملف المصدر: النص حرفيًا،
> والصفحة المعلنة، والبصمة — 15961/15961.
>
> **الترخيص غير مؤكد**، لذلك: النص محجوب عن الـAPI العام (`text_available:false`)،
> وملفات المصدر في `backend/data/` **خارج git** (المستودع عام). التفاصيل في
> `reports/CONTENT_LICENSE.txt`.

## 1. المشروع

| | |
|---|---|
| قاعدة البيانات | PostgreSQL 16 / Supabase — مخطط `corpus` |
| الـAPI | Node 22، بلا إطار، `node:http` + `pg` |
| البحث | Full Text Search + `pg_trgm` بتطبيع عربي |
| الأمن | RLS، أدوار Supabase، JWT إداري، تحديد معدّل، ترويسات، سجلّ تدقيق |
| التوثيق | `openapi.yaml` (OpenAPI 3.1، 28 مسارًا / 29 عملية) |
| الاختبارات | Vitest على PostgreSQL حقيقي — 145 اختبارًا |

**القاعدة الحاكمة (SOURCE_LOCK):** لا يُولَّد نص شرعي ولا يُصحَّح ولا يُعاد صياغته ولا
يُستكمل بالتخمين. ما لا يوجد في المصدر يبقى `NULL`. لا يوجد أي مسار في هذا النظام —
عام أو إداري — يعدّل `raw_text`؛ التعديل يعني **إصدار مجموعة بيانات جديدة**.

## 2. Architecture

```
ملف مصدر مصرَّح باستخدامه
        │  (لا Scraping، لا اتصال بموقع المصدر وقت الطلب)
        ▼
Raw Import ──► Parser/Adapter ──► Validation ──► Import ──► Verify (hash)
        ▼
PostgreSQL / Supabase  (corpus schema · RLS · SOURCE_LOCK triggers)
        ▼
REST API /api/v1  (public: read-only · admin: import/verify/audit)
        ▼
Flutter FALAH
```

## 3. Database

مخطط `corpus` — 16 جدولًا (14 مطلوبًا + `app_settings` لعلم الترخيص +
`verification_samples` لعيّنة التحقق البشرية):

`sources` · `editions` · `books` · `chapters` · `hadiths` · `narrators` ·
`hadith_narrators` · `hadith_sources` · `hadith_gradings` · `hadith_references` ·
`raw_imports` · `dataset_versions` · `verification_records` ·
`verification_samples` · `audit_logs` · `app_settings`

ضمانات على مستوى قاعدة البيانات لا على مستوى الكود:

* `content_hash` عمود **مولَّد** `sha256(raw_text)` — لا يمكن لأحد كتابته يدويًا.
* `trigger hadiths_source_lock` يرفض تعديل النص/الرقم/التخريج/الدرجة/الإصدار لأي سجل
  `source_locked` ما لم تُفتح البوابة داخل معاملة المستورد.
* `trigger hadiths_locked_delete` يرفض الحذف — لا حذف تكرارات أعمى (§37).
* `check hadiths_verified_consistent` يمنع `verified=true` بلا `verification_status='verified'`.
* `view corpus.hadiths_public` يحجب النص ما لم يكن علم الترخيص `true`.

الهجرات: `0003_hadith_corpus.sql` · `0004_hadith_corpus_search.sql` ·
`0005_hadith_corpus_rls.sql` · `0006_hadith_verification_samples.sql` ·
`0007_hadith_source_locator.sql` · `0008_shamela_source.sql`
(تراكمية فوق 0001/0002 لتطبيق فلاح).

**طبعة بلا ترقيم:** «الجامع الكامل» لا يطبع رقمًا مسلسلًا للأحاديث، فـ`hadith_number`
يبقى `NULL` لكل السجلات. الهوية هي `source_locator` (`ج1/ص107/#1`) — موضع في المطبوع
لا رقم حديث، وهو ما يجعل إعادة الاستيراد لا تُكرّر شيئًا.

## 4. Import process

`RAW → PARSE → VALIDATE → IMPORT → VERIFY`

```bash
# فحص بلا كتابة واحدة في قاعدة البيانات
npm run import -- --file ./data/jami-kamil.json --adapter jami_kamil \
  --edition jami-kamil-1437 --dry-run

# الاستيراد الفعلي
npm run import -- --file ./data/jami-kamil.json --adapter jami_kamil \
  --edition jami-kamil-1437 --dataset JAMI-KAMIL-1437-V1 --actor "اسمك"
```

المحوّلات (`src/importer/adapters/`): `jami_kamil_shamela` (نصّ الشاملة لهذه الطبعة) ·
`jami_kamil` (عقد JSON) · `generic_json` · `generic_csv` · `generic_html`.
إضافة مصدر جديد = ملف محوّل واحد، بلا مساس بالـAPI.

استيراد الطبعة كاملة (الملفات في `backend/data/`، خارج git):

```bash
bash scripts/import-jami-kamil.sh --dry-run   # فحص 12 مجلدًا بلا كتابة
bash scripts/import-jami-kamil.sh             # الاستيراد (46 ثانية)
node --experimental-strip-types src/scripts/sample-verify.ts 15961   # مطابقة كل سجل بالمصدر
```

ما لا يفعله المحوّل عمدًا: لا يخترع رقم حديث، ولا يفصل متنًا عن سند، ولا يصحّح
إملاءً (خطأ «الشعارير» ج1 ص158 مخزَّن كما ورد)، ولا يأخذ اسم الراوي إلا إذا أغلقته
أداة المصدر نفسها (`عن فلان قال/أنّ…`) — وإلا `NULL` (14,754 من 15,961).

كل تشغيل يكتب سجلًا في `corpus.raw_imports` وتقريرًا في `reports/`، ويُنشئ
`verification_records` من نوع `hash_check` — وهي **لا** تجعل الحديث `verified`
(«مستورد» ≠ «موثَّق»؛ التوثيق البشري عبر `POST /api/v1/admin/hadiths/{id}/verify`).

PDF غير مدعوم عمدًا — سببه في `contracts/DATA_CONTRACT.md`.

## 5. Environment variables

انسخ `.env.example` إلى `.env`. الأهم:

| المتغير | الأثر |
|---|---|
| `DATABASE_URL` | اتصال Postgres/Supabase (خادميًا فقط) |
| `CONTENT_LICENSE_CONFIRMED` | `false` ⇒ الـAPI العام يُرجع `raw_text/matn/isnad/takhrij = null` |
| `SUPABASE_SERVICE_ROLE_KEY` | خادميًا فقط — **ممنوع** في Flutter أو أي عميل |
| `SUPABASE_JWT_SECRET` | التحقق من JWT الإداري (`app_metadata.corpus_role = admin`) |
| `ADMIN_API_KEY` | مفتاح خادم-لخادم للمستورد/CI |
| `MAX_PAGE_LIMIT` | سقف `limit` (افتراضي 100) |

## 6. Supabase setup

1. أنشئ مشروعًا، ثم `supabase db push` لتطبيق `supabase/migrations/*`.
2. Settings → Database → Connection string ⇒ `DATABASE_URL` (للخادم فقط).
3. Settings → API → JWT Secret ⇒ `SUPABASE_JWT_SECRET`.
4. لمنح مستخدم صلاحية إدارية: `app_metadata.corpus_role = "admin"`.
5. الأدوار `anon/authenticated/service_role` موجودة في Supabase؛ الهجرة تُنشئ
   بدائل بلا دخول عند التشغيل على Postgres عادي حتى تبقى الهجرات قابلة للاختبار.

## 7. Migrations

```bash
# على Supabase
supabase db push
# أو على أي Postgres
for f in ../supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
# قاعدة اختبار محلية جاهزة
npm run db:reset
```

## 8. API endpoints

`/api/v1` — الاستجابة موحّدة: `{ success, data, meta }` أو `{ success, error }`.

**عام (قراءة فقط):** `health` · `stats` · `hadiths` · `hadiths/{id}` ·
`hadiths/by-number/{number}` · `books` · `books/{id}` · `books/{id}/hadiths` ·
`chapters` · `chapters/{id}` · `chapters/{id}/hadiths` · `narrators` ·
`narrators/{id}` · `narrators/{id}/hadiths` · `sources` · `editions` ·
`editions/{id}` · `search`

**إداري (Bearer):** `admin/stats` · `admin/imports` · `admin/imports/{id}` ·
`admin/dataset-versions` · `admin/audit-logs` · `admin/hadiths/{id}` ·
`admin/hadiths/{id}/verify` · `admin/verifications` ·
`admin/verification-samples` (GET/POST) · `admin/verification-status`

الترقيم: `?page=1&limit=20`، و`limit` فوق السقف يُرفض بـ422 لا يُقصّ بصمت.

## 9. Authentication

* العام: بلا مصادقة، قراءة فقط، محدود المعدّل.
* الإداري: `Authorization: Bearer <JWT>` بـ`app_metadata.corpus_role = "admin"`،
  أو `ADMIN_API_KEY` للاستخدام خادم-لخادم. لا يوجد مفتاح في العميل إطلاقًا.

## 10. Search

`GET /api/v1/search?q=…&type=hadiths|narrators|chapters|books`
مع مرشّحات `source` و`grading` و`volume` و`page_number` و`hadith_number` و`book_id`…

التطبيع (`corpus.normalize_ar`) يزيل التشكيل والتطويل ويوحّد الهمزات والألف المقصورة
والتاء المربوطة والأرقام الهندية — **للبحث فقط**؛ النص المخزَّن لا يُمسّ أبدًا.
الفهارس: GIN على `search_tsv`، وGIN/`gin_trgm_ops` على النص والأسماء والأبواب.

## 11. Deployment

* **Supabase + خادم Node**: ارفع الصورة (`Dockerfile`) إلى أي مستضيف حاويات،
  واضبط المتغيرات. لا حالة في الذاكرة عدا عدّاد المعدّل.
* **محليًا بالكامل**: `docker compose up` (Postgres + API).
* Staging أولًا بـ`ENVIRONMENT=staging` و`CONTENT_LICENSE_CONFIRMED=false`.
* لم تُستخدم Supabase Edge Functions هنا: طبقة Node تُشغَّل وتُختبر فعليًا في CI
  (`.github/workflows/backend.yml`)، وهي أبسط في التشغيل والاختبار من دالة Deno
  مكافئة — `simplicity-first`.

## 12. Flutter integration

`flutter_app/lib/features/hadith/`:
`domain/models.dart` · `data/hadith_api_client.dart` · `data/hadith_repository.dart` ·
`data/hadith_providers.dart` (Riverpod) · `presentation/hadith_books_screen.dart`
(الحالات الأربع، نصوص من ملف الترجمة، `EdgeInsetsDirectional`).

```dart
final hadith = await ref.read(hadithRepositoryProvider).getHadith(id);
if (hadith.textAvailable) Text(hadith.rawText!); // لا نص بديل ولا تخمين
```

عنوان الـAPI: `--dart-define=FALAH_API_BASE_URL=https://api.falah.app`.

## 13. Testing

```bash
npm run db:reset && npm test    # 145 اختبارًا على PostgreSQL حقيقي
npm run typecheck
npm run verify                  # تقرير سلامة البيانات (21 قاعدة)
npm run smoke                   # نداء فعلي لكل نقطة نهاية مقابل خادم يعمل
```

التغطية: وحدات · استيراد · API · قاعدة بيانات · بحث · أمن (SQLi، JWT، صلاحيات،
ترويسات) · ترقيم · سلامة بيانات (بقواعد تُختبَر بزرع مخالفة لكل قاعدة ثم التراجع) ·
عيّنة التحقق · علم الترخيص · مطابقة OpenAPI للمسارات المخدومة. التقارير في `reports/`.

## 14. Data verification

`imported ≠ verified`. الاستيراد يثبّت `verification_status = 'pending'`.
`hash_check` آليّ يثبت أن النص المخزَّن هو النص المستورد، ولا يرفع الحالة.
`verified = true` يحتاج `manual_sample` أو `external_source` بنتيجة `passed`
و`content_hash` مطابقًا للنص الحالي — وإلا فالطلب يُرفض بـ409.

عيّنة التحقق البشرية (§48) في `corpus.verification_samples`: حجم العيّنة ومعرّفاتها
والمحقِّق والمرجع وعدد المطابقات والفروق. حالة `passed` مرفوضة — في الـAPI وفي قيد
قاعدة البيانات معًا — ما لم تطابق كل سجلات العيّنة بلا فرق واحد، وكل معرّف في العيّنة
يجب أن ينتمي إلى نفس `dataset_version` المُتحقَّق منها.

## 15. License / content rights status

`CONTENT_LICENSE_CONFIRMED=false` · `corpus.sources.license_status = 'unconfirmed'`
لمصدر ketabonline. لا يُنشر النص للعامة قبل تأكيد الحقوق كتابةً؛ التفعيل بعدها
بتغيير متغيّر بيئة واحد و`corpus.app_settings`، بلا أي تغيير في الكود.
