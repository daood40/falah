# ADR-002 — Supabase (PostgreSQL + Auth + Storage + Edge Functions)

**الحالة:** معتمد ومنفَّذ.

## السياق
المنصة تحتاج قاعدة علائقية بصلاحيات صفّية (RLS)، ومصادقة، وتخزين ملفات، ودوال خادمية
لأسرار AI والنشر.

## القرار
Supabase: المخطط في `supabase/migrations/0001_init.sql` (21 جدولًا، RLS على كل جدول،
`audit_logs` append-only)، والتحقق يجري في CI على PostgreSQL 16 حقيقي
(`scripts/validate-db.sh`). دالة `ai-assistant` تحمل مفتاح Anthropic على الخادم فقط.

## البديل المرفوض
Firebase: NoSQL بلا علاقات قوية، قواعد أمان أقل تعبيرًا من RLS، وترخيص مغلق.

## السبب
SQL علائقي + RLS أصلية + ترخيص مفتوح (v2 §27).

## الأثر الحالي
التطبيق يعمل بوضع محلي صادق بدون Supabase؛ عند ضبط `VITE_SUPABASE_URL/ANON_KEY`
تتفعل المصادقة والمزامنة. جداول v2 الإضافية (§29) تُضاف بهجرات تراكمية — لا إعادة بناء.
