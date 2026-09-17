# memory/FIXES.md   (الأحدث في الأعلى)

## 2026-09-09 — التاريخ الهجري بالعربية في وضع EN
العَرَض: بطاقة الترحيب تعرض «٢٦ ربيع الأول…» رغم أن الواجهة إنجليزية.
السبب الجذري: ‏Intl formatter مثبّت على ‏ar-SA في hijri.ts بلا اعتبار للغة.
الحل: ‏hijriToday(date, locale) بمنسّقَي ar/en · الملفات: src/core/hijri/hijri.ts،
src/features/home/HomePage.tsx.
الوقاية: بند «تسرّب لغة» في جولة qa-localization-testing لكل شاشة جديدة؛
مؤكد بالتشغيل: «Rabiʻ I 27, 1448 AH».

## 2026-09-09 — كسر بناء APK بعد إضافة versionCode ديناميكي
العَرَض: «Value is null» في build.gradle سطر 19 على CI.
السبب الجذري: ‏Groovy فسّر `versionCode (X).toInteger()` على أنه
`(versionCode(X)).toInteger()` فاستدعى toInteger على null.
الحل: إسناد صريح `versionCode = (...)` · الملف: android/app/build.gradle
· commit: ‏27c9c59.
الوقاية: أي خاصية Gradle بقيمة محسوبة تُكتب بإسناد `=` صريح.

## 2026-09-08 — «/ 33» ينقلب «33 /» في RTL
العَرَض: شرطة الهدف قبل الرقم معكوسة في سبحة الـPWA وFlutter.
السبب الجذري: محارف محايدة الاتجاه ترث اتجاه الفقرة RTL.
الحل: ‏dir="ltr" على العنصر (PWA) وtextDirection.ltr ‏(Flutter).
الوقاية: أي نص «رموز + أرقام لاتينية» يُثبَّت LTR صراحة.

## 2026-09-08 — pumpAndSettle يعلق في اختبارات widget
العَرَض: مهلة 10 دقائق في كل اختبار يحمّل أصولًا.
السبب الجذري: تحميل rootBundle يعمل موثوقًا في أول اختبار فقط، والمؤشر
الدوّار حركة لا تنتهي فلا «يستقر» الإطار.
الحل: مستودع واحد يُسخَّن في setUpAll ويُحقن، وحلقة settle محدودة تفحص
المؤشرات غير المحددة · الملف: flutter_app/test/app_widget_test.dart.
الوقاية: لا pumpAndSettle مع I/O حقيقي أو حركات لانهائية.

## 2026-09-17 — عيوب كشفتها بوابة CI

- الصورة لا تنسخ `migrations/`: الحاوية تقلع و/health يرد 200 لكن كل قراءة
  محتوى 500 لأن المخطط لم يُنشأ. (`quran_api/Dockerfile`)
- `loadEnv` كان يعود إلى قاعدة محلية عند غياب DATABASE_URL، ويقبل سرًّا من 5
  أحرف. الآن يرفض الإقلاع في غير بيئة الاختبار. (`src/config/env.ts`)
- الصورة بلا هوية بناء: `/api/v1/version` يرد commit=null. أُضيف
  BUILD_COMMIT/BUILD_TIME كوسيطي بناء.
- التطبيق يطلب `limit=300` والحد 100 → على جهاز حقيقي فشلت 114 سورة و30 جزءًا
  بـVALIDATION_ERROR. (`quran_api_repository.dart`)
- مستودع الصوت كان يقرأ الصفحة الأولى فقط؛ الآن يمشي على كل الصفحات.
  (`audio_repository.dart`)
