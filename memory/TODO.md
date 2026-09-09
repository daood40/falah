# memory/TODO.md   (آخر تحديث: 2026-09-09)

## P0 — يمنع النشر على المتجر (كلها خطوات مالك)
- [ ] حساب مطور Google Play ‏(25$) + التحقق (docs/RELEASE_PLAY.md §2)
- [ ] توليد مفتاح التوقيع + الأسرار الأربعة في GitHub ثم تشغيل
      «Android Release (AAB)» ورفع الناتج على Internal testing
- [ ] إرسال Project URL + anon key لتفعيل Supabase (docs/SUPABASE_SETUP.md)
      — تذكير: يستلزم تحديث نموذج أمان البيانات وprivacy.html قبل أي
      إصدار يحوي المزامنة، وإضافة حذف حساب

## P1 — بعد الإطلاق
- [ ] قرار مالك (بوابة 14): تقارير أعطال عن بُعد (تغيّر نموذج البيانات
      و«لا تتبع») أم الاكتفاء بالسجل المحلي — docs/QA_REPORT.md
- [ ] بوابة 16 (مفتاح إيقاف عن بُعد) تُبنى ضمن تفعيل Supabase
- [ ] ‏Flutter M2: المحرر والقوالب وتصدير الصور (MIGRATION.md)
- [ ] ربط سبحة/أذكار Flutter بالمزامنة عند تفعيل Supabase
- [ ] حذف الفروع القديمة من واجهة GitHub (claude/quiz-platform-build-swm4wi،
      claude/project-structure-overview-lfiuui، gh-pages) — الوكيل ممنوع من حذف refs

## P2 / لاحقًا
- [ ] iOS ‏(M4): حساب Apple + TestFlight
- [ ] رفع skills-repo كمستودع daood40/skills لتفعيل زر sync-skills
- [ ] حسم تداخل مهارات التصميم القديمة (design-taste-frontend وأخواتها)
      مع حزمة design الجديدة — توصية صاحب الحزمة: حذف القديمة (قرار مالك)
