# PROJECT_STATUS — حالة مشروع فلاح

**آخر تحديث:** 2026-08-28 · **المرجع الملزم:** وثيقة التوجيه v2 (حلّت محل v1.0)
· **الإصدار الحي:** 1.4.0 (React PWA) · **الاختبارات:** 58/58 ✅

## الحالة التشغيلية (يجب أن تبقى خضراء دائمًا)

| القناة | الحالة |
|---|---|
| الموقع المنشور | https://daood40.github.io/falah/ — ينشر تلقائيًا من `main` |
| بناء APK | workflow ‏`android.yml` أخضر؛ الملف في Actions → Artifacts → `falah-apk` |
| app id | `app.falah.studio` — ثابت، لا يتغير |
| CI | فحوص الأنواع + Lint + الاختبارات + مخطط قاعدة البيانات على PostgreSQL 16 حقيقي |

## تحليل الفجوات مقابل v2 (خلاصة — التفصيل الزمني في ROADMAP.md)

### موجود ويُبقى كما هو
البنية Clean (core/features بطبقاتها)، SOURCE_LOCK بأربع نقاط إنفاذ، محرك القرآن الكامل
offline، الأربعون النووية الموثقة، المحرر والقوالب وتصدير PNG، فيديو المعاينة على الجهاز،
المكتبة والإشعارات، مخطط 21 جدولًا بـ RLS، النشر التلقائي (Pages/APK)، وضع محلي صادق،
Entitlements كبيانات.

### موجود واحتاج تعديلًا (نُفِّذ في هذه الجلسة — إصدار 1.4.0)
- نصوص رفض AI وُحِّدت حرفيًا على الملحق (هـ) + كشف طلبات الفتوى وتحريف النص
  (`features/ai/domain/assistant.ts`، اختبارات حمراء جديدة).
- الجدولة: Retry بـ Exponential Backoff (حد 3) + `idempotency_key` لكل منشور؛
  الأخطاء الدائمة (not_configured/source_lock/validation) تفشل فورًا بصدق
  (`features/scheduler/domain/scheduler.ts`).
- `.env.example` مواءم مع أسماء الملحق (ب).
- التوثيق: ARCHITECTURE حُدّث بخريطة مواءمة v2 بدل إعادة كتابته.

### جديد كليًا (لم يُنفَّذ بعد — مرتب في ROADMAP.md)
Google/Apple Sign-In، تفسير السعدي والكتب الستة (بعد توثيق التراخيص في SOURCE_POLICY)،
جداول v2 الإضافية بهجرة `0002_v2.sql`، سير المراجعة البشرية وRBAC الخمسة أدوار،
Context Validation للاجتزاء، Version History وAuto-Save الدوري، Metadata داخل ملفات
التصدير، FFmpeg Worker (ADR-004)، Tool Calling + Output Guard خادميًا (ADR-005)،
Connectors فعلية + تشفير KMS (ADR-006)، الدفع، لوحة الإدارة، **هجرة Flutter (ADR-001
— لا تبدأ إلا بقرار صريح؛ خطتها في MIGRATION.md)**.

## ما تغيّر بسبب v2 في هذه الجلسة
1. توثيق جديد: `docs/adr/` (القرارات الستة)، `MIGRATION.md`، `ROADMAP.md`،
   `SKILL_REGISTRY.md`، `docs/AI_RULES.md`، `docs/SOURCE_POLICY.md`، هذا الملف.
2. كود (أصغر تغيير ممكن، بلا هدم): بنود "احتاج تعديلًا" أعلاه — 6 ملفات مصدر،
   واختباران جديدان (58 بدل 55).
3. لا تغيير على: الواجهات العاملة، الـworkflows، المخطط، الموقع المنشور.

## قرارات مسجلة أثناء التنفيذ (v2 §5)
- تصنيف أخطاء النشر إلى دائمة/عابرة: الإعادة التلقائية للعابرة فقط — إعادة محاولة
  منصة غير مهيأة كذبٌ مؤجل. (scheduler.ts)
- أنماط كشف التحريف تتعمد تجاهل «غير/عدل» المجردتين (نفي/اسم) لتفادي رفض
  عمليات بحث مشروعة. (assistant.ts)
- أسماء الملحق (ب) طُبقت على أسرار الخادم؛ متغيرات العميل تحتفظ ببادئة `VITE_`
  التي يفرضها Vite.

## المتبقي للجلسات القادمة (بالأولوية)
1. هجرة `0002_v2.sql` (جداول v2 الناقصة + `verification_records` فعليًا).
2. Google Sign-In (يحتاج تهيئة Google في Supabase من المالك).
3. استيراد تفسير السعدي بمصدر مرخّص موثق.
4. Context Validation في Quran Creator.
5. Metadata (source_id/content_hash) داخل PNG المصدَّر.
6. Version History + Auto-Save كل 5 ثوانٍ في المحرر.

## ما يحتاج Credentials من المالك (الملحق ج)
مفاتيح Supabase (المزامنة/الحسابات)، `AI_API_KEY` عبر `supabase secrets set`،
App ID/Secret لكل منصة اجتماعية، FCM/APNs، مزود بريد، حسابات المتاجر.
