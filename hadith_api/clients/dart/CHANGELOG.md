# CHANGELOG — falah_hadith_api

## 1.2.0
* تغطية كاملة لعقد الـOpenAPI: `getCrossChecks` لسجل واحد، `getNarratorHadiths`،
  و`getCrossCheckReviewQueue` بنموذج `ReviewQueueItem`.
* نماذج جديدة: `CrossCheck`, `ReviewQueueItem`, `HadithEdition`, `Collection`,
  `Volume`, `CrossCheckSummary`.
* حقول عدّ في `Grading` و`HadithBook` و`HadithStats`، وفصول الكتاب في
  `HadithBook.chapters` عند طلب الفهرس الشجري.
* `Hadith.raw` يحتفظ بالاستجابة كما وصلت، و`HadithCache.toJson/loadJson`
  ليحفظ المستهلك الكاش على القرص بلا تسلسل ثانٍ فاقد.

## 1.1.0
* `HadithCache` بقواعد البصمة: `dataset_version` + `content_hash`.
* دوال الطبعات والمصادر وإصدارات البيانات.

## 1.0.0
* الإصدار الأول: النماذج، عميل HTTP، والمستودع.
