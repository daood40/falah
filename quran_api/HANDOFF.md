# FALAH Quran API — تسليم للمبرمج

هذا المجلد (`quran_api/`) مستقل بالكامل: الهجرات، الاستيراد، الخادم، الاختبارات،
الصورة. لا يحتاج شيئًا من بقية المستودع.

## تشغيل (Node 22.6+ · PostgreSQL 16 مع pgcrypto وpg_trgm)

```bash
cp .env.example .env      # DATABASE_URL + SUPABASE_JWT_SECRET (≥ 32 حرفًا)
npm ci
npm run db:apply          # migrations/001..008 بالترتيب
npm run import -- --version=2026.09.18-1 --translations=en --publish
npm run serve             # http://127.0.0.1:8787/api/v1/health
```

أو حاوية: `docker build -t falah-quran-api .` ثم
`docker run -p 8787:8787 -e DATABASE_URL=… -e SUPABASE_JWT_SECRET=… -e ENVIRONMENT=production falah-quran-api`
(الحاوية ترفض الإقلاع بلا DATABASE_URL أو بسر قصير).

## الوضع الخاص (لا يُغيَّر)

`PRIVATE_MODE=true` (الافتراضي) → لا بيانات عامة ولا API عام؛ الطلبات المصادَقة
فقط تقرأ النص (`Authorization: Bearer <Supabase JWT>`). ‏`/health` و`/version` بلا توكن.
لا تُرفع `PUBLIC_DATA_ENABLED` أو `CONTENT_LICENSE_CONFIRMED` — قرار المالك بعد التراخيص.

## المسارات (60 مسارًا — العقد الكامل في `openapi/openapi.yaml` ويُقدَّم حيًّا من `/api/v1/openapi.yaml`)

```
system   /health · /version · /stats · /sources · /editions · /datasets · /schemes ·
         /catalog (auth) · /licenses (auth)
quran    /surahs[?revelation=makkah|madinah&sort=number|revelation_order] ·
         /surahs/{id} (+structure) · /surahs/{id}/ayahs · /ayahs/{id} · /ayahs/by-key/{s}:{a}
struct   /juzs · /juzs/{n}[/ayahs] · /hizbs · /hizbs/{n}[/ayahs] · /rubs · /rubs/{n}[/ayahs] ·
         /pages · /pages/{p}[/ayahs] · /manzils · /manzils/{n}[/ayahs] ·
         /rukus[?surah=] · /rukus/{n}[/ayahs] · /sajdahs
search   /search?q=…[&surah=&exact=]
text     /translations · /qiraat · /riwayat
audio    /reciters … (فارغ حتى يصل Dataset صوتي مرخّص)
user     /me/bookmarks · /me/favorites · /me/favorite-reciters · /me/progress ·
         /me/audio-progress · /me/settings   (auth)
```

- كل القوائم: `page` و`limit` (الحد الأقصى 100؛ `/surahs` يقبل 114).
- الغلاف: `{ success, data, meta }` أو `{ success:false, error:{ code, message } }`؛
  كل استجابة تحمل `x-request-id`.
- الأرقام: 114 سورة · 6,236 آية · 30 جزءًا · 60 حزبًا · 240 ربعًا · 604 صفحات ·
  7 منازل · 556 ركوعًا · 15 سجدة.

## أمثلة جاهزة

`examples/` (cURL, JS, TS, Dart, Flutter, Python, PHP) — كلها تقرأ `FALAH_API_BASE_URL`.
دليل الاستخدام المفصّل: `API_USAGE.md`. جرد البيانات وتراخيصها: `DATA_CATALOG.md`.

## قواعد لا تُخالَف

- SOURCE_LOCK: نص الآية غير قابل للتعديل على مستوى القاعدة (trigger). لا يُؤلَّف
  أو يُعدَّل نص شرعي، ولا يُستخدم AI عليه.
- الصلاحيات على الخادم (RLS مفروضة)، لا أسرار في العميل.
- الاختبارات: `npm test` (106) و`npm run gate:core` (~40,000 حالة، صفر فشل مطلوب).
