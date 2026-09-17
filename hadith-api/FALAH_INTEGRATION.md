# ربط FALAH بـ Hadith API

كل ما يحتاجه مطوّر Falah — لا أكثر.

```
FALAH → HadithRepository → HadithApiClient → HTTPS → Hadith API → PostgreSQL
```

Falah لا يحمل نسخة من قاعدة الأحاديث، ولا يعرف SQL ولا Supabase. الـAPI هو مصدر البيانات.

---

## 1. Base URL

| البيئة | العنوان |
|---|---|
| محلي | `http://127.0.0.1:8787` |
| إنتاج | **لا يوجد بعد** — الخدمة غير منشورة (لا مستضيف ولا اعتمادات) |

المواصفة الحيّة: `GET /openapi.yaml` · فهرس الموارد: `GET /`

```dart
const apiBase = String.fromEnvironment('FALAH_API_BASE_URL',
    defaultValue: 'http://127.0.0.1:8787');
final repo = HadithRepository(HadithApiClient(baseUrl: apiBase));
```

## 2. المصادقة

القراءة العامة **بلا مفتاح**. مسارات `/api/v1/admin/*` وحدها تتطلب
`Authorization: Bearer <ADMIN_API_KEY>` وتُستعمل من خادم فقط.

**Falah لا يحمل**: `DATABASE_URL` · `service_role` · `ADMIN_API_KEY` · أي سرّ.

## 3. الموارد الرسمية

| المورد | الاستدعاء في Dart | ملاحظة |
|---|---|---|
| `GET /hadiths` | `getHadiths(...)` | قائمة مختصرة + ترقيم |
| `GET /hadiths/{id}` | `getHadith(id, include: [...])` | الاستجابة القياسية |
| `GET /hadiths/random` | `getRandomHadith()` | سجل موجود فعلًا، لا توليد |
| `GET /hadiths/daily` | `getDailyHadith()` | حتمي: نفس اليوم + نفس المجموعة = نفس الحديث |
| `GET /hadiths/by-number/{n}` | `getHadithByNumber(n)` | هذه الطبعة بلا ترقيم ⇒ 404 |
| `GET /hadiths/{id}/narrators` | `getNarrators(id)` | |
| `GET /hadiths/{id}/references` | `getReferences(id)` | |
| `GET /hadiths/{id}/takhrij` | `getTakhrij(id)` | النص كما هو |
| `GET /hadiths/{id}/gradings` | `getGradings(id)` | صفر أو أكثر — لا درجة إجبارية |
| `GET /hadiths/{id}/verification` | `getVerification(id)` | ثلاث طبقات منفصلة |
| `GET /sources` · `/sources/{id}` | `getSources()` · `getSource(id)` | حالة الترخيص |
| `GET /books` · `/books/{id}` | `getBooks()` · `getBook(id)` | |
| `GET /books/{id}/chapters` | `getChapters(bookId)` | مع نطاق الصفحات |
| `GET /books/{id}/hadiths` | `getBookHadiths(bookId)` | |
| `GET /chapters/{id}` · `/chapters/{id}/hadiths` | `getChapter(id)` · `getChapterHadiths(id)` | |
| `GET /narrators` | `getAllNarrators()` | |
| `GET /gradings` | `getGradingLabels()` | تصنيف الدرجات وعددها |
| `GET /search?q=` | `searchHadiths(q, ...)` | |
| `GET /catalog` | `getCatalog(withChapters: true)` | الشجرة كاملة بلا نصوص |
| `GET /stats` | `getStats()` | |
| `GET /health` | `healthy()` | |
| `GET /version` · `/datasets` | `getVersion()` · `getDatasets()` | هوية المجموعة وبصمتها |

## 4. النماذج

`Hadith` · `HadithSummary` · `HadithSource` · `HadithBook` · `HadithChapter` ·
`Narrator` · `HadithReference` · `Takhrij` · `Grading` · `Verification` ·
`DatasetVersion` · `ApiVersion` · `HadithStats` · `Paged<T>` · `Ref`

لا `Map<String, dynamic>` في كود Falah.

## 5. أمثلة

```dart
// قائمة + ترقيم
final page = await repo.getHadiths(page: 1, limit: 20);
print('${page.currentPage}/${page.totalPages} من ${page.total}');

// تفصيل + الأجزاء الثقيلة عند الحاجة فقط
final h = await repo.getHadith(page.items.first.id,
    include: ['gradings', 'takhrij', 'verification']);
print('${h.book?.name} · ${h.chapter?.name} · ج${h.location.volume} ص${h.location.page}');
for (final g in h.gradings) print('${g.text} — ${g.source}');

// بحث عربي (لا حساسية للتشكيل ولا الهمزات)
final hits = await repo.searchHadiths('الصلاة', limit: 20);

// حديث اليوم — ثابت طوال اليوم
final daily = await repo.getDailyHadith();

// شجرة التصفّح بلا نصوص
final books = await repo.getCatalog(withChapters: true);
```

### النص المحجوب — القاعدة الوحيدة التي يجب احترامها في الواجهة

```dart
if (h.textAvailable) {
  Text(h.text!);            // النص كما ورد من المصدر، بلا تعديل حرف
} else {
  Text(t.hadith_textWithheld);  // «النص غير متاح حتى تأكيد حقوق النشر»
}
```

لا نصّ بديل، ولا تلخيص، ولا توليد. `text == null` حالة صحيحة لا خطأ.

## 6. الأخطاء

```dart
try {
  final h = await repo.getHadith(id);
} on ApiException catch (e) {
  if (e.isNotFound) showEmptyState();
  else if (e.code == 'RATE_LIMITED') retryLater();
  else showError(e.message);
}
```

`NOT_FOUND` 404 · `VALIDATION_ERROR` 422 · `RATE_LIMITED` 429 ·
`UNAUTHORIZED` 401 · `INTERNAL_ERROR` 500. الردّ لا يحمل SQL ولا أثر مكدّس.

## 7. الترقيم

`?page=&limit=` بسقف **100**؛ ما فوقه يُرفض بـ422 (لا يُقصّ بصمت).
الـmeta: `page` · `current_page` · `limit` · `total` · `total_pages`.

## 8. البحث

`q` (حرفان فأكثر) · `book_id` · `chapter_id` · `source_id` · `grading` ·
`volume` · `page_number` · `type=hadiths|narrators|chapters|books` · `page` · `limit`.
النتائج في `data` (بالشكل المختصر) والعدّادات في `meta`.

## 9. التخزين المؤقت

خزّن `dataset_hash` من `getVersion()`. إن تغيّر ⇒ المجموعة تغيّرت ⇒ أفرغ الكاش.

```dart
class CachedHadith {
  final String id;              // المفتاح
  final Map<String, dynamic> data;
  final String datasetVersion;
  final String contentHash;     // بصمة السجل نفسه
  final DateTime fetchedAt;
}
```

كاش Flutter فقط (‏`shared_preferences`/`sqflite`) — **لا قاعدة بيانات ثانية كاملة داخل التطبيق**.

## 10. هوية المجموعة

```
dataset_version : JAMI-KAMIL-1437-V1
dataset_hash    : 694a5afe4ac80aad4f3cd133ae1364160a3e23d6925774cd6f27868ecdb6cb7c
record_count    : 15961
status          : sealed
```

## 11. الأمان

قراءة فقط للعامة · تحديد معدّل لكل IP · ترويسات أمنية · RLS على كل جدول ·
لا كتابة من العميل · مسارات الإدارة منفصلة بمفتاح خادمي.

## 12. سلامة النص

النص يُعاد كما هو من المجموعة: **لا توليد، ولا تصحيح، ولا درجة، ولا تخريج، ولا
نسبة من الذكاء الاصطناعي**. `verified` لا يصير `true` إلا بعيّنة تحقق بشرية
مسجّلة — وهي لم تُنفَّذ بعد، فالقيمة `false` على كل السجلات.

## 13. حالة الترخيص

`CONTENT_LICENSE_CONFIRMED=false` ⇒ الـAPI العام يُرجع النص `null` مع
`text_available:false`. التكامل جاهز بالكامل، لكن **لا تُنشر الخدمة للعامة
بنصّها قبل تأكيد الحقوق كتابةً** (`reports/CONTENT_LICENSE.txt`).
