# memory/TODO.md   (آخر تحديث: 2026-09-16)

## P0 — يمنع النشر على المتجر (كلها خطوات مالك)
- [ ] حساب مطور Google Play ‏(25$) + التحقق (docs/RELEASE_PLAY.md §2)
- [ ] توليد مفتاح التوقيع + الأسرار الأربعة في GitHub ثم تشغيل
      «Android Release (AAB)» ورفع الناتج على Internal testing
- [ ] إرسال Project URL + anon key لتفعيل Supabase (docs/SUPABASE_SETUP.md)
      — تذكير: يستلزم تحديث نموذج أمان البيانات وprivacy.html قبل أي
      إصدار يحوي المزامنة، وإضافة حذف حساب

## P0 — منصة بيانات القرآن (خطوات مالك)
- [ ] تشغيل الـAPI فعليًا: تزويد `DATABASE_URL` (Supabase) و`SUPABASE_JWT_SECRET`
      ثم `npm run db:apply && npm run import -- --publish` (quran_api/README.md §7)
- [ ] حسم تضارب ترخيص quran-json: `package.json` يقول CC BY 4.0 و`LICENSE.txt`
      يقول CC BY-SA 4.0، ولا إذن صريح من صاحب النص الأصلي (quranenc.com).
      يلزم بيان مكتوب قبل رفع `CONTENT_LICENSE_CONFIRMED` و`PUBLIC_DATA_ENABLED`
      (التفاصيل: quran_api/reports/LICENSE_AUDIT.txt)
- [ ] تراخيص الترجمات العشر (كلها LICENSE_PENDING) — إذن لكل مترجم أو حذف اللغات
      غير الموثقة قبل النشر
- [ ] توفير Dataset صوتي مرخّص (manifest يذكر القارئ والرواية والترخيص وروابط
      الملفات) لتفعيل التلاوات — البنية والاستيراد والتحقق جاهزة
      (`npm run import:audio -- manifest.json`؛ العقد في
      `quran_api/schemas/audio-manifest.schema.json` والقالب بجانبه)

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
