# falah_hadith_api — عميل Dart / Flutter

عميل رسمي لـ **FALAH Hadith API**: نماذج مكتوبة الأنواع، عميل HTTP، مستودع يغطي
كل نقطة نهاية موثّقة، وكاش يرفض أي سجل لم تعد بصمته أو مجموعته مطابقة للخادم.

تبعية واحدة: `http`. يعمل في Flutter وفي Dart الصِّرف.

## التثبيت

```yaml
dependencies:
  falah_hadith_api:
    git:
      url: https://github.com/daood40/falah.git
      path: hadith_api/clients/dart
      ref: main
```

بعد فصل الخدمة إلى مستودعها الخاص (`bash scripts/extract-repo.sh`):

```yaml
dependencies:
  falah_hadith_api:
    git:
      url: <عنوان المستودع المستقل>
      path: clients/dart
      ref: main
```

داخل نفس المستودع (كما يفعل تطبيق فلاح اليوم):

```yaml
dependencies:
  falah_hadith_api:
    path: ../hadith_api/clients/dart
```

## الاستخدام

```dart
import 'package:falah_hadith_api/falah_hadith_api.dart';

final repo = HadithRepository(HadithApiClient(baseUrl: apiBaseUrl));

// قراءة
final page    = await repo.getHadiths(limit: 20);
final hadith  = await repo.getHadith(page.items.first.id,
                                     include: ['takhrij', 'gradings', 'verification']);
final results = await repo.searchHadiths('إنما الأعمال بالنيات');

// التصنيفات
final books       = await repo.getBooks();
final chapters    = await repo.getChapters(books.items.first.id);
final volumes     = await repo.getVolumes();
final collections = await repo.getCollections();
final gradings    = await repo.getGradingLabels();
final narrators   = await repo.getAllNarrators(name: 'أبو هريرة');
final catalog     = await repo.getCatalog(withChapters: true);

// هوية البيانات والتحقق
final version  = await repo.getVersion();      // dataset_version + dataset_hash
final checks   = await repo.getCrossChecks(hadith.id);
final queue    = await repo.getCrossCheckReviewQueue();
```

## النص المحجوب

ما دامت بوابة الترخيص مغلقة على الخادم، يعود `text` بقيمة `null` مع
`textAvailable == false`. هذه حالة صحيحة لا خطأ:

```dart
if (hadith.textAvailable) {
  show(hadith.displayText!);
} else {
  show(l10n.textWithheld);   // لا تضع نصًا بديلًا، ولا تخزّن نصًا محليًا
}
```

## الكاش

```dart
final cache = HadithCache();
cache.syncDataset(await repo.getVersion());  // بصمة جديدة ⇒ يُفرَّغ الكاش
cache.put(hadith);
final cached = cache.get(hadith.id);          // null إن تغيّرت المجموعة أو البصمة
```

للحفظ على القرص: `cache.toJson()` و`cache.loadJson(...)` مع أي تخزين تستعمله
(‏`shared_preferences`، ملف، `sqflite`). القواعد في الحزمة لا في التخزين.

## الأخطاء

كل فشل يصل كـ`ApiException(code, message, statusCode)`. الرموز:
`NETWORK_ERROR` · `NOT_FOUND` · `VALIDATION_ERROR` · `BAD_REQUEST` ·
`RATE_LIMITED` · `CONTENT_LICENSE_RESTRICTED` · `INTERNAL_ERROR`.

## ثوابت

- لا مفتاح في العميل: القراءة العامة بلا مصادقة، ومسارات `/admin/*` من خادم فقط.
- النص يعاد كما أرسله الخادم — لا تعديل ولا إعادة صياغة ولا اشتقاق.
