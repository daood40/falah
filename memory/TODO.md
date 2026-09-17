# memory/TODO.md   (آخر تحديث: 2026-09-16)

## P0 — يمنع النشر على المتجر (كلها خطوات مالك)
- [ ] حساب مطور Google Play ‏(25$) + التحقق (docs/RELEASE_PLAY.md §2)
- [ ] توليد مفتاح التوقيع + الأسرار الأربعة في GitHub ثم تشغيل
      «Android Release (AAB)» ورفع الناتج على Internal testing
- [ ] إرسال Project URL + anon key لتفعيل Supabase (docs/SUPABASE_SETUP.md)
      — تذكير: يستلزم تحديث نموذج أمان البيانات وprivacy.html قبل أي
      إصدار يحوي المزامنة، وإضافة حذف حساب

## P0 — خادم الحديث (خطوات مالك)
- [x] توفير ملفات «الجامع الكامل» — استُوردت 15,961 حديثًا (2026-09-16)
- [ ] عيّنة تحقق بشرية: قارن 30 حديثًا بالمطبوع ثم
      POST /api/v1/admin/verification-samples (بدونها verified=false للجميع)
- [ ] مراجعة 1,638 سجلًا لم يؤيّدها المصدر المستقل:
      GET /api/v1/cross-checks/review-queue (الأرجح فروق ألفاظ أو نقص المرجع)
- [ ] مصدر مرجعي ثانٍ يغطي الحاكم/الطبراني/البيهقي/ابن حبان
- [ ] إذن إعادة التوزيع مكتوبًا ⇒ يُودع في hadith_api/ ويُذكر في LICENSE_AUDIT
      ثم تُفتح البوابتان (CONTENT_LICENSE_CONFIRMED + PUBLIC_DATA_ENABLED)
- [ ] مستضيف للـAPI ⇒ ينتهي حجب DEPLOYMENT ويظهر عنوان عام
- [ ] تأكيد حقوق النشر كتابةً قبل رفع CONTENT_LICENSE_CONFIRMED إلى true
      وتحديث corpus.sources.license_status
- [ ] ضبط DATABASE_URL/SUPABASE_JWT_SECRET/ADMIN_API_KEY في بيئة النشر
- [ ] اختيار مستضيف للـAPI (لا يوجد نشر ولا عنوان عام حتى الآن)

## P1 — بعد الإطلاق
- [ ] قرار مالك (بوابة 14): تقارير أعطال عن بُعد (تغيّر نموذج البيانات
      و«لا تتبع») أم الاكتفاء بالسجل المحلي — docs/QA_REPORT.md
- [ ] بوابة 16 (مفتاح إيقاف عن بُعد) تُبنى ضمن تفعيل Supabase
- [ ] ‏Flutter M2: المحرر والقوالب وتصدير الصور (MIGRATION.md)
- [ ] ربط سبحة/أذكار Flutter بالمزامنة عند تفعيل Supabase
- [ ] شاشة قارئ الحديث في Flutter فوق hadith_repository (بعد وصول البيانات)
- [ ] عيّنة تحقق بشرية بعد أول استيراد عبر POST /api/v1/admin/verification-samples
      (الآلية جاهزة ومختبرة؛ ينقصها نص مستورد ونسخة مطبوعة للمقارنة)
- [ ] حذف الفروع القديمة من واجهة GitHub (claude/quiz-platform-build-swm4wi،
      claude/project-structure-overview-lfiuui، gh-pages) — الوكيل ممنوع من حذف refs

## P2 / لاحقًا
- [ ] iOS ‏(M4): حساب Apple + TestFlight
- [ ] رفع skills-repo كمستودع daood40/skills لتفعيل زر sync-skills
- [ ] حسم تداخل مهارات التصميم القديمة (design-taste-frontend وأخواتها)
      مع حزمة design الجديدة — توصية صاحب الحزمة: حذف القديمة (قرار مالك)
