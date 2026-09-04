# GATES — بوابات الجودة الإلزامية لفلاح (عقد التطوير)

**المرجع:** MASTER APP DEVELOPMENT CHECKLIST (46 قسمًا) التي اعتمدها المالك
2026-09-04. القاعدة: لا تمر مرحلة بلا **دليل رقمي**، و«PASS» بلا أرقام لا يُقبل.
الحالة أدناه محدثة للإصدار **2.1.0**. الرموز: ✅ PASS بدليل · 🟡 جزئي · ⏸ ينتظر
مدخلات المالك · ⬜ لم يبدأ.

## PRODUCT GATE — ✅ PASS

- تعريف المنتج والقيمة والنطاق: `README.md` + وثيقة التوجيه v2
- تحليل سوق موثق المصادر (قادة، مشاكلهم، ميزتنا): `docs/MARKET.md` (٨ فئات)
- MVP → V2 روadmap مرتب: `ROADMAP.md` (مراحل 0-7)

## ARCHITECTURE GATE — ✅ PASS

- Clean Architecture ‏core/features بطبقات domain/data/presentation: `docs/ARCHITECTURE.md`
- قرارات ملزمة موثقة: `docs/adr/` (6 ADRs)
- ‏Modular Monolith عمدًا (حجم المشروع لا يبرر Microservices)

## UX/UI GATE — ✅ PASS

- ‏Design System بالكامل من Tokens: `src/core/design/tokens.css` (صفر ألوان صلبة خارجية)
- حالات Loading/Empty/Error/Success في كل صفحة؛ ثيم ورق قديم فاتح + جلد داكن
- ‏RTL/LTR + عربية/إنجليزية: 352 مفتاح ترجمة، صفر نصوص داخل الكود
- إتاحة: حبس تركيز، skip-link، أهداف لمس ≥44px، تباين مفحوص

## FRONTEND GATE — ✅ PASS (React PWA — راجع «قرار المنصة» أدناه)

- ‏TypeScript strict، ‏75/75 اختبارًا، ‏lint/format نظيفة
- ‏Router بحراسة + lazy routes + ErrorBoundary
- ‏Offline-first: القرآن كاملًا مدمج، Service Worker v3 مختبر
- الحزمة الرئيسية 385KB (gzip 128KB)

## DATABASE GATE — ✅ PASS

```
Schema apply (CI, PostgreSQL 16):  0001 + 0002  PASS
Tables:                            34 (21 + 13)
Policies (RLS):                    38 (23 + 15)
RLS behavioral assertions:         4/4 PASS  (عزل قراءة/كتابة بين مستخدمين)
Constraint/seed sanity:            PASS (plans=3, sources=4)
Local restore test (backup):       unit-tested PASS
```

- ‏Soft-delete وretention: ⬜ يُضاف مع تفعيل المزامنة الفعلية

## AUTH GATE — 🟡

- ‏Email/كلمة مرور عبر Supabase + وضع محلي صادق: ✅ (الكود جاهز)
- التشغيل الحي + Password Reset UI + Google Sign-In: ⏸ ينتظر مفاتيح Supabase
  (خطوات المالك في `docs/SUPABASE_SETUP.md`)

## AUTHORIZATION GATE — ✅ PASS (بنية) / ⏸ (تشغيل حي)

- خمسة أدوار في `user_roles` + سياسات ملكية لكل جدول؛ مثبتة سلوكيًا في CI

## SECURITY GATE — ✅ PASS

```
CSP (self scripts, allow-list):        PASS   (index.html)
Secrets in client:                      0
Upload validation (type+8MB):          PASS   (الموضعان)
SQLi/XSS surface:                      لا SQL بالعميل؛ لا innerHTML بمدخلات
RLS enforced+tested:                   4/4 CI
SOURCE_LOCK (بصمات + بوابة تصدير):     مختبر بوحدات
History scan for secrets:              PASS (جلسة النشر الأولى)
```

- ‏Rate limiting خادمي + كشف إساءة: ⏸ بعد Supabase

## API GATE — ✅ PASS (البنية)

- ‏Edge Function واحدة (AI): تحقق نوع/طول، تاريخ محدود، مفتاح خادمي فقط
- ‏SocialPublisher بواجهة موحدة ترفض بصدق عند عدم التهيئة (لا Mock success)

## STORAGE GATE — ✅ (محلي) / ⏸ (سحابي)

- ‏IndexedDB بمخطط مرقّم (v5) + نسخة احتياطية/استعادة بملف واحد
- ‏Object Storage سحابي: يُفعّل مع Supabase

## TESTING GATE — ✅ PASS

```
Unit/Integration:   75/75   (16 ملفات)
DB schema (CI):     PASS    (PostgreSQL 16 حقيقي)
RLS behavioral:     4/4     (CI + محلي)
E2E regression:     PASS    (صفر أخطاء Console)
E2E click-sweep:    12 مسارًا، كل عنصر تفاعلي، صفر أخطاء (npm run sweep)
```

- ‏Load/Stress: ⬜ يصبح ذا معنى بعد وجود خادم

## PERFORMANCE GATE — ✅ PASS

- ‏gzip 128KB رئيسية، تقسيم لكل سورة، Supabase lazy، فهارس القاعدة، pagination

## CI/CD GATE — ✅ PASS

- ‏Push → typecheck/lint/format/tests/build + schema+RLS على Postgres حقيقي
- النشر: ‏Pages من main فقط؛ ‏APK تلقائي لكل push؛ ‏rollback = revert merge

## INFRASTRUCTURE GATE — ✅ (بلا خادم)

- استضافة CDN ‏(GitHub Pages) + SSL + Domain فرعي؛ تكلفة تشغيل = صفر

## MONITORING GATE — 🟡

- على الجهاز: سجل أخطاء محلي (error/unhandledrejection) في الإعدادات ✅
- خادمي (Sentry-like/Uptime): ⏸ بعد وجود خادم

## BACKUP GATE — ✅ (محلي) / ⏸ (سحابي)

- تصدير/استيراد كامل مختبر؛ ‏PITR السحابي يأتي مع Supabase (مدمج فيها)

## LEGAL GATE — 🟡

- خصوصية وشروط داخل التطبيق (٤ ضمانات ملموسة) ✅؛ صفحات قانونية مفصلة
  وسياسة حذف حساب: تُكتب مع تفعيل الحسابات

## STORE GATE — ⏸

- ‏APK debug جاهز؛ ‏Google Play يحتاج حساب مطور (25$) + keystore توقيع منك
- ‏iOS يحتاج حساب Apple Developer‏ (99$/سنة) — خارج النطاق حاليًا

## POST-LAUNCH GATE — 🟡

- الويب حي منذ v2.0.0 ويُراقب عبر Actions + سجل الأخطاء المحلي

---

## قرار المنصة (يحتاج جوابك)

آخر قائمتك تفترض **Flutter + Supabase**. فلاح مبني **React PWA + Capacitor**
(يعمل ويب وأندرويد الآن). ‏ADR-001 ينص: لا هجرة Flutter إلا بقرار صريح منك،
وخطتها كاملة في `MIGRATION.md`. البوابات أعلاه تنطبق على المنصتين؛ الهجرة
تعيد فتح FRONTEND/TESTING GATES من الصفر (أسابيع عمل) مقابل أداء أصلي أعلى
على الجوال.

## قاعدة دائمة (من هذا العقد)

كل إصدار قادم يُحدّث هذا الملف بأرقام أدلته قبل أن يُعلن جاهزًا،
ولا يُقال PASS بلا رقم أو مرجع.
