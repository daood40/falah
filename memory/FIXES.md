# memory/FIXES.md   (الأحدث في الأعلى)

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
