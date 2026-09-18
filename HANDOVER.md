# تسليم — FALAH Hadith API

خدمة REST مستقلة فوق PostgreSQL تخدم مجموعة أحاديث مستوردة ومُتحقَّقًا منها.
هذا الملف كل ما يحتاجه المبرمج ليشغّلها ويستهلكها. لا يحتاج شيئًا خارج هذا
المجلد.

---

## 1. ما هذا بالضبط

| | |
|---|---|
| المكدّس | Node 22 + PostgreSQL 16 · بلا إطار عمل · تبعية واحدة وقت التشغيل: `pg` |
| السطح | 50 نقطة نهاية تحت `/api/v1` · المواصفة `openapi.yaml` (49 مسارًا) |
| البيانات | «الجامع الكامل في الحديث الصحيح الشامل» — 15,959 سجلًا، إصدار مختوم `JAMI-KAMIL-1437-V2` |
| العملاء | Dart/Flutter (حزمة `clients/dart`) · TypeScript (ملف واحد `clients/typescript`) |
| الاختبارات | 204 اختبار خدمة · تدقيق آلي بـ274 ألف فحص (`npm run audit`) |

**النص الشرعي محجوب.** بوابتان مستقلتان مغلقتان
(`CONTENT_LICENSE_CONFIRMED=false`, `PUBLIC_DATA_ENABLED=false`) فيعود حقل
`text` بقيمة `null` مع `text_available:false`. هذه حالة صحيحة لا خطأ: اعرض
رسالة، ولا تضع نصًا بديلًا. تُفتح البوابتان بمتغيّر بيئة فقط — بلا تغيير كود
— بعد وصول إذن إعادة التوزيع المكتوب.

---

## 2. التشغيل في خمس دقائق

```bash
npm ci

# قاعدة بيانات فارغة + كل الهجرات بالترتيب
createdb hadith
for f in migrations/*.sql; do psql -d hadith -v ON_ERROR_STOP=1 -f "$f"; done

cp .env.example .env        # املأ DATABASE_URL على الأقل
npm start                   # http://127.0.0.1:8787/api/v1
```

أو بحاوية:

```bash
docker compose up           # يطبّق الهجرات ثم يشغّل الخدمة
```

فحص سريع:

```bash
curl -s http://127.0.0.1:8787/api/v1/health
curl -s http://127.0.0.1:8787/api/v1/hadiths?limit=5
curl -s "http://127.0.0.1:8787/api/v1/search?q=الصلاة&limit=5"
```

**البيانات ليست في هذا المجلد.** ملفات الطبعة (`data/`) والتصدير (`exports/`)
مستبعدة من المستودع لأن حق إعادة التوزيع غير مؤكَّد. لتعبئة قاعدة البيانات:

```bash
DATA_DIR=<مجلد ملفات الطبعة> bash scripts/import-jami-kamil.sh --dry-run   # تحقّق أولًا
DATA_DIR=<مجلد ملفات الطبعة> bash scripts/import-jami-kamil.sh
npm run verify        # 21 قاعدة سلامة
npm run sample-verify # مطابقة كل سجل بملف مصدره: نص حرفي + صفحة + بصمة
```

---

## 3. متغيّرات البيئة

| المتغيّر | الافتراضي | ملاحظة |
|---|---|---|
| `DATABASE_URL` | — | **إلزامي** |
| `PORT` | 8787 | |
| `ENVIRONMENT` | staging | staging \| production \| test |
| `CONTENT_LICENSE_CONFIRMED` | false | يفتح النص في استجابات الـAPI |
| `PUBLIC_DATA_ENABLED` | false | يفتح النص في التصدير الجماعي |
| `ADMIN_API_KEY` | — | مسارات `/admin/*` فقط، من خادم إلى خادم |
| `DEFAULT_PAGE_LIMIT` / `MAX_PAGE_LIMIT` | 20 / 100 | |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | 60000 / 120 | لكل IP |
| `CORS_ORIGINS` | `*` | |
| `ACTIVE_DATASET_VERSION` | JAMI-KAMIL-1437-V2 | |

لا سرّ في أي استجابة، ولا مفتاح في أي عميل: القراءة العامة بلا مصادقة.

---

## 4. العقد

كل استجابة ناجحة:

```json
{ "success": true, "data": …, "meta": { "page": 1, "current_page": 1, "limit": 20,
                                        "total": 15959, "total_pages": 798 } }
```

وكل خطأ:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" },
  "meta": { "request_id": "…" } }
```

| الرمز | HTTP |
|---|---|
| `BAD_REQUEST` | 400 — جسم تالف أو ترميز نسبة مئوية فاسد |
| `UNAUTHORIZED` | 401 — مسار إداري بلا مفتاح |
| `NOT_FOUND` | 404 |
| `METHOD_NOT_ALLOWED` | 405 |
| `VALIDATION_ERROR` | 422 — مُعامل غير صالح، `limit` فوق السقف، عدد خارج المدى، حرف تحكم |
| `RATE_LIMITED` | 429 — انظر `Retry-After` |
| `INTERNAL_ERROR` | 500 — بلا أي تفصيل داخلي |

### الموارد

```
# الأحاديث
GET /api/v1/hadiths?page=&limit=&book_id=&chapter_id=&narrator_id=&source_id=
                   &volume=&page_number=&grading=&verification_status=
GET /api/v1/hadiths/{id}?include=narrators,references,takhrij,gradings,verification
GET /api/v1/hadiths/random            GET /api/v1/hadiths/daily
GET /api/v1/hadiths/by-number/{n}
GET /api/v1/hadiths/{id}/narrators|references|takhrij|gradings|verification|cross-checks

# التصنيفات
GET /api/v1/books        GET /api/v1/books/{id}/chapters   GET /api/v1/books/{id}/hadiths
GET /api/v1/chapters/{id}/hadiths                          GET /api/v1/catalog?chapters=true
GET /api/v1/volumes      GET /api/v1/volumes/{n}/hadiths
GET /api/v1/collections  GET /api/v1/collections/{name}/hadiths
GET /api/v1/gradings     GET /api/v1/narrators?name=       GET /api/v1/narrators/{id}/hadiths
GET /api/v1/sources      GET /api/v1/editions              GET /api/v1/references

# البحث والنظام
GET /api/v1/search?q=&type=hadiths|narrators|chapters|books&…
GET /api/v1/health  GET /api/v1/version  GET /api/v1/datasets  GET /api/v1/stats
GET /api/v1/cross-checks/summary   GET /api/v1/cross-checks/review-queue

# إداري (Authorization: Bearer $ADMIN_API_KEY)
GET  /api/v1/admin/stats|imports|dataset-versions|audit-logs|verifications|verification-status
POST /api/v1/admin/hadiths/{id}/verify      POST /api/v1/admin/verification-samples
```

البحث عربي مُطبَّع على الخادم (تشكيل، همزات، تاء مربوطة، ألف مقصورة، أرقام)،
فأرسل المصطلح كما كتبه المستخدم بلا معالجة.

أمثلة جاهزة بسبع لغات في `API_USAGE.md`، والمواصفة الكاملة في `openapi.yaml`
(وتُخدم أيضًا على `{BASE}/openapi.yaml`).

---

## 5. قواعد لا تُخالَف

1. **SOURCE_LOCK**: النص المستورد مقفل في قاعدة البيانات (مشغّلات ترفض UPDATE
   وDELETE). التصحيح = إصدار بيانات جديد، لا تعديل في مكانه.
2. **لا تأليف ولا تصحيح ولا إعادة صياغة** لنص أو سند أو تخريج أو درجة — لا
   بيد ولا بذكاء اصطناعي. المعلومة غير الموجودة تبقى `null`.
3. كل سجل يحمل `content_hash` (‏SHA-256 لنصه) وكل مجموعة تحمل `dataset_hash`.
   خزّنهما في أي كاش، وأبطِل الكاش عند تغيّر البصمة.
4. **التحقق ثلاث طبقات منفصلة**: مطابقة المصدر (آلية على الملف)، مقارنة متقاطعة
   بمجموعة مستقلة (آلية)، ومراجعة بشرية. `verified=true` لا يُمنح إلا بالثالثة.
   لا تعرض مقارنة آلية على أنها حكم شرعي.
5. لا تنشر النص قبل فتح البوابتين بإذن مكتوب.

---

## 6. الاختبار والتشغيل المستمر

```bash
npx tsc --noEmit                 # الأنواع
npx vitest run                   # 204 اختبارًا (يحتاج DATABASE_URL لقاعدة اختبار)
npm run verify                   # 21 قاعدة سلامة بيانات
npm run security:scan            # لا سرّ في الشجرة
npm run smoke                    # كل نقطة نهاية على خادم يعمل
npm run backup:test              # نسخ واسترجاع مع مطابقة البصمة
npm run audit                    # التدقيق الكامل (يحتاج بيئة staging تعمل)
npm run staging:up               # ينشر نسخة محلية على :8799 من نسخة احتياطية
```

`.github/workflows/ci.yml` يشغّل هذه البوابات على كل دفع.

---

## 7. ما ينقص (بصراحة)

| البند | الحالة |
|---|---|
| إذن إعادة التوزيع المكتوب | **غير موجود** — البوابتان مغلقتان |
| استضافة وعنوان عام | **لا يوجد** — يعمل محليًا وفي حاوية فقط |
| تحقق بشري من عيّنة | **صفر** — الآلية جاهزة والنتيجة `verification_status=pending` |
| بناء Docker في هذه البيئة | لم يُشغَّل (لا daemon) — يعمل في CI |
| 1,395 سجلًا | لم تؤيّدها المجموعة المرجعية المستقلة → طابور مراجعة بشرية، بلا تعديل |

التقارير والأدلة الرقمية كاملة في `reports/` — أهمّها
`FINAL_QA_AUDIT.txt` (274,919 فحصًا · 0 فشل) و`HADITH_FINAL_INTEGRITY.txt`
(15,959/15,959 مطابقة حرفية) و`CROSS_CHECK.txt` و`CONTENT_LICENSE.txt`.
