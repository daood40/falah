# memory/ARCHITECTURE.md   (آخر تحديث: 2026-09-09)

## PWA (المنتج الحي — `src/`)
- الطبقات: صفحات features/ → مخازن zustand → مستودعات data/ → أصول/IndexedDB.
- `src/core/`: tokens.css (ورق قديم/جلد — مصدر الألوان الوحيد)، i18n (ar/en)،
  db (kv على IndexedDB)، sourcelock، monitor (سجل أخطاء العميل).
- التوجيه: createBrowserRouter؛ النشر على Pages بمسار /falah/ مع 404 fallback.
- ممنوع: ألوان/مقاسات خام خارج tokens، نص شرعي غير ملفوف بـSOURCE_LOCK.

## Flutter (`flutter_app/`)
- الطبقات: screens → Riverpod providers (`lib/app/providers.dart`) →
  QuranRepository → أصول `assets/quran/` (نفس بيانات الـPWA حرفيًا،
  بصمات sha256 متطابقة عبر المنصتين).
- `lib/core/`: sourcelock (منقول 1:1 من TS)، theme/tokens (منقول من tokens.css)،
  arabic (تطبيع + مراجع)، settings، dhikr.
- التوجيه: StatefulShellRoute بأربعة فروع (/, /quran/:n, /tasbih/azkar, /settings).
- الثيم من ثوابت Tokens فقط — لا ColorScheme.fromSeed (قرار مستودع).

## أندرويد (المتجر)
- غلاف Capacitor في `android/` يلفّ dist؛ appId `app.falah.studio`؛
  targetSdk 36؛ إذن INTERNET فقط؛ التوقيع من `key.properties` (أسرار CI).
- عند M4: يستبدل Flutter الغلاف بنفس الـappId (MIGRATION.md).

## تدفّق البيانات
كل شيء محلي (IndexedDB / shared_preferences). لا شيء يغادر الجهاز إلا
بمشاركة يدوية. Supabase لاحقًا عبر anon key فقط — service_role لا يدخل
العميل أبدًا، والصلاحيات بسياسات RLS (مختبرة سلوكيًا في CI).
