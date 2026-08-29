# فلاح — FALAH

منصة صناعة وتنظيم ونشر المحتوى الإسلامي الموثوق (PWA + تطبيق أندرويد عبر Capacitor).
اللغة الأساسية للمستخدمين: العربية (RTL) مع دعم الإنجليزية.

## التقنيات
- React 18 + TypeScript (strict) + Vite 5، اختبارات Vitest + Testing Library.
- الحالة: Zustand. التخزين المحلي: Dexie (IndexedDB). الخلفية: Supabase (Auth/DB/Storage/Edge Functions).
- Capacitor 8 للأندرويد. Service Worker يدوي في public/sw.js.

## الأوامر
- install: `npm install` · dev: `npm run dev` · test: `npm test`
- lint: `npm run lint` · typecheck: `npm run typecheck` · build: `npm run build`
- تحقق قاعدة البيانات: `npm run db:validate` (يتطلب PostgreSQL محليًا)

## البنية
- `src/core/` بنية مشتركة: db، i18n، sourcelock، supabase، theme، ui، models.
- `src/features/<feature>/` ميزة لكل مجلد (quran، hadith، editor، video، ai، …).
- `src/app/` التخطيط والتنقل. `src/test/` إعداد الاختبارات.
- `supabase/migrations/` ترحيلات SQL مرقّمة. `supabase/functions/` دوال Edge.
- `docs/` التوثيق، `docs/decisions/` قرارات معمارية (ADR).

## القواعد الثابتة
- **SOURCE LOCK**: لا يُعرض أو يُصدَّر نص ديني (قرآن/حديث/تفسير) إلا من مصدر موثّق
  عبر `src/core/sourcelock/`. الذكاء الاصطناعي لا يؤلف نصوصًا دينية أبدًا.
- كل نص للمستخدم عبر `src/core/i18n/` (ar.ts + en.ts معًا)؛ لا نصوص ثابتة في المكونات.
- RTL أولًا: خصائص CSS منطقية (inline-start/end)، لا left/right.
- لا `any` بلا تبرير في تعليق. كل تغيير مخطط DB = ملف ترحيل جديد + RLS على كل جدول.
- الأسرار من البيئة فقط (`.env` غير مُتتبَّع؛ حدّث `.env.example`). مفتاح service_role لا يصل للعميل أبدًا.
- قبل التسليم: typecheck + lint + test تنجح كلها.

## لا تلمس
- `dist/`، `android/app/build/`، أي ملفات مولّدة.
- بيانات القرآن/الحديث المرفقة (quran-json، nawawi-40) — لا تعديل على النصوص الدينية.
- ملفات الترحيل المطبّقة سابقًا — أضف ترحيلًا جديدًا بدل تعديل قديم.
