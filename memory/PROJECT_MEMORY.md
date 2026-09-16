# memory/PROJECT_MEMORY.md   (آخر تحديث: 2026-09-16)

## ما هو
فلاح — منصة لصانع المحتوى الإسلامي: تصميم منشورات آيات وأحاديث موثقة،
قراءة القرآن دون إنترنت، سبحة وأذكار. القاعدة الحاكمة SOURCE_LOCK:
لا يُؤلَّف أو يُعدَّل نص شرعي أبدًا.

## المكدّس
- المنتج الحي: React 18 + TS strict + Vite PWA (v2.2.0) + غلاف Capacitor
  لأندرويد (app.falah.studio). ينشر من main إلى GitHub Pages.
- الهجرة الجارية: Flutter 3.35.4 في `flutter_app/` (Riverpod + go_router +
  shared_preferences + crypto). الـPWA تبقى المنتج الحي حتى M4 (MIGRATION.md).
- الخلفية: Supabase (مخطط 34 جدولًا في public) — غير مفعّلة، تنتظر مفاتيح المالك.
- منصة بيانات القرآن: `quran_api/` (Node 22 + TypeScript + PostgreSQL، مخطط
  `quran` بـ31 جدولًا، 54 نقطة REST، OpenAPI، خط استيراد وتحقق بالبصمات).
  المصادر: quran-json@3.1.2 (CC BY-SA 4.0) + quran-meta@6.0.17 (MIT).

## الحالة اليوم (2026-09-09)
- يعمل: الـPWA كاملة (قرآن/حديث/محرر/فيديو/مكتبة/جدولة/سبحة/أذكار/ورد)،
  وتطبيق Flutter بشاشاته الست (رئيسية/سور/قارئ/سبحة+صيغ ذكر/أذكار/إعدادات).
- لا يعمل: المزامنة والحسابات (لا مفاتيح Supabase بعد)؛ iOS مؤجل (لا حساب Apple).

## أين توقّفنا
2026-09-16 (PRIVATE MODE): المشروع كله صار خاصًا بقرار المالك حتى تصل التراخيص.
`PRIVATE_MODE=true` افتراضيًا ومفروض بالكود (يجبر الأعلام العامة على false،
يربط على 127.0.0.1، ويرفض إقلاع نسخة عامة بلا تراخيص). أُضيف مركز تراخيص
(هجرة 0005) لا يقبل CONFIRMED بلا دليل، وبوابة نشر واحدة `release:gate`
(BLOCKED بـ13 شرطًا)، وowner_dropzone بـ12 مجلدًا خارج git، وتوثيق خاص
(PRIVATE_DOCUMENTATION/LICENSING/PRIVATE_DEPLOYMENT/DATA_PROVENANCE) وقائمة
OWNER_LICENSE_CHECKLIST. الـPWA noindex وrobots يمنع الفهرسة. 217 اختبارًا PASS.

2026-09-16 (Public API): صار الـAPI خدمة مستقلة موثّقة — `/version` و
`/openapi.yaml` حيّان، `API_USAGE.md` وسبعة أمثلة عملاء (شُغّلت فعليًا)،
Dockerfile للإنتاج، إعدادات بيئات Flutter (dev/staging/prod بلا رابط مضمّن)،
بوابة اعتماد بشري في هجرة 0004 تمنع النشر بلا توقيع شخص، وفحص أسرار في CI.
203 اختبارًا PASS. الباقي كله على المالك: نشر + تراخيص + صوت + اعتماد بشري.

2026-09-16 (تدقيق نهائي): التقارير الثلاثة في `quran_api/reports/`
(QURAN_FINAL_INTEGRITY 41/41 · LICENSE_AUDIT · FINAL_PRODUCTION_AUDIT).
اكتُشف تضارب ترخيص في quran-json (package.json يقول CC BY 4.0 وLICENSE.txt
يقول CC BY-SA 4.0) فصار مصدر النص `restricted` والترجمات LICENSE_PENDING.
أُضيف عقد manifest صارم للصوت + تحقق يرفض أي بيانات ناقصة.
PRODUCTION READY = NO (نشر + تراخيص + Dataset صوتي).

2026-09-16: بُنيت منصة بيانات القرآن كاملة وشُغّلت فعليًا: هجرة 0003، استيراد
114 سورة/6,236 آية/62,360 ترجمة (10 لغات) بـ0 أخطاء، تقرير سلامة 30/30،
65 اختبار API على PostgreSQL حقيقي، OpenAPI مطابق للراوتر، وطبقة Flutter
(`features/quran_api`) مع 17 اختبارًا جديدًا. الصوت BLOCKED: لا Dataset مرخّص
والمنفذ الخارجي يحجب CDN التلاوات. لم يُنشر خادم (NOT DEPLOYED).

2026-09-09: دُمج PR #18 — حزمة نشر Google Play كاملة (توقيع + workflow AAB
+ privacy.html + RELEASE_PLAY.md). المتبقي على المالك: حساب Play + مفتاح
التوقيع والأسرار الأربعة، ثم تشغيل «Android Release (AAB)» ورفع الناتج.
الخطوة التقنية التالية: M2 المحرر في Flutter حسب MIGRATION.md، أو ربط
Supabase عند وصول المفاتيح.
