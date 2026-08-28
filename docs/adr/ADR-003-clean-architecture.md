# ADR-003 — Clean Architecture + Feature-based + Repository + DI

**الحالة:** معتمد ومنفَّذ (بأدوات الويب الحالية).

## السياق
v2 §27 يعتمد Clean Architecture مع Riverpod (وهي أداة Flutter).

## القرار
- البنية المطبقة اليوم: `core/` + `features/<name>/{domain,data,presentation}` —
  المنطق في `domain` نقي بلا React ومغطى بالاختبارات؛ الوصول للبيانات عبر
  Repositories (`quranRepository`, `hadithRepository`, `libraryRepository`…).
- إدارة الحالة حاليًا **Zustand** (مكافئ الويب الأخف)؛ **Riverpod** يُعتمد عند تنفيذ
  ADR-001 — الطبقتان `domain/data` تنتقلان كما هما مفهوميًا.

## البديل المرفوض
Bloc / GetX: صخب أعلى (Bloc) أو Anti-patterns وصعوبة اختبار (GetX).

## السبب
قابلية اختبار وفصل طبقات (v2 §27). التغطية الحالية: 55 اختبارًا على domain/data.

## الأثر الحالي
لا تغيير. قاعدة مستمرة: أي منطق جديد يوضع في `domain` نقيًا ليكون قابلًا للنقل إلى Dart.
