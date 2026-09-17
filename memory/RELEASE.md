# memory/RELEASE.md

## الحالي: 2.2.0 — 2026-09-09
الحالة: الويب منشور على https://daood40.github.io/falah/ من main ·
غير منشور على المتاجر بعد (حزمة Play جاهزة، تنتظر حساب المالك والمفتاح).
فيه (بلغة المستخدم):
- تصميم آيات وأحاديث موثقة ومشاركتها صورًا وفيديو
- قرآن كامل دون إنترنت مع بحث وصوت
- سبحة وأذكار وورد يومي
- يعمل كله دون حسابات ودون إعلانات
معروف فيه: لا مزامنة بين الأجهزة (Supabase غير مفعّلة بعد).

## القادم: أول إصدار متجر (نفس 2.2.0 كـAAB)
شرطه: خطوات المالك في docs/RELEASE_PLAY.md + متطلب Google للحسابات
الجديدة (اختبار مغلق 12 مختبِرًا / 14 يومًا) قبل الإنتاج.

## 2026-09-17 — بوابة الجودة على CI

39,404 حالة، صفر FAIL/BLOCKED/SKIPPED، من ستة عمّال CI (core, web, flutter,
docker, android×2) ثم وظيفة دمج تُسقط التشغيل عند أي FAIL أو BLOCKED أو
SKIPPED أو معرّف مكرر أو فئة تحت حدها. التقرير النهائي:
`quran_api/reports/RELEASE_REPORT.txt`.

- TECHNICALLY READY FOR FALAH INTEGRATION = YES
- RELEASE GATE = FAIL — التراخيص (quran_text، 10 ترجمات، صوت، قارئ) والتحقق
  البشري ونشر النسخة لم تتم. الأعلام تبقى: PRIVATE_MODE=true،
  PUBLIC_DATA_ENABLED=false، CONTENT_LICENSE_CONFIRMED=false.
- خارج النطاق بقرار المالك: iOS (لا macOS runner) وHadith API (لم يُبنَ).
