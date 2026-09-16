# memory/TEST_RESULTS.md   (تشغيل حقيقي فقط)

## 2026-09-09 (مساءً) — جولة بوابات qa-production-readiness
- التقرير الكامل: `docs/QA_REPORT.md` — النتيجة NO-GO ‏(11 PASS، ‏2 FAIL
  قراري، ‏3 NOT RUN تحتاج جهاز/خادم، ‏1 BLOCKED خارجي)
- جديد اليوم: `npm run db:validate` → ‏«rls behavioral: pass» على Postgres
  حقيقي · جولة عدائية (مدخلات خبيثة/عمق/‏320px/‏EN/‏offline SW) → علة
  واحدة أُصلحت وأُكدت · إعادة البوابات 1-4 بعد الإصلاح: خضراء

## 2026-09-09 — الجلسة المحلية (sandbox) + CI
- ‏`npm test`: ‏75 نجحت / 0 فشلت (16 ملفًا)
- ‏`npm run lint` و`npm run typecheck`: صفر أخطاء
- ‏`npm run sweep`: ‏12 مسارًا، نقر كل عنصر تفاعلي، صفر أخطاء console
- ‏`flutter test`: ‏29 نجحت / 0 فشلت (sourcelock ‏12 + مستودع 8 + widget ‏9)
- ‏`flutter analyze`: ‏0 مشاكل · `flutter build web`: نجح
- ‏CI على merge PR #18 (‏43fe09d): ‏CI ✓ · Build Android APK ✓ ·
  Flutter CI ✓ (على 15f6371) · Pages deploy ✓
- لم يُشغَّل: db:validate في هذه الجلسة (آخر تشغيل أخضر في CI ‏v2.1)،
  اختبار على جهاز أندرويد فعلي (لا جهاز — يُغطى عبر Internal testing)

## 2026-09-16 — quran_api (تشغيل فعلي)

| ما شُغّل | النتيجة |
|---|---|
| migrations 0001+0002+0003 على PostgreSQL 16.13 | PASS |
| import --validate-only | success · 0 issues |
| import --publish (10 ترجمات) | 68,596 سجلًا · 0 failed · 0 invalid · 0 missing |
| integrity-report | PASS 30/30 |
| vitest (API/RLS/أمان/استيراد/OpenAPI) | 68/68 PASS |
| tsc --noEmit (strict) | PASS |
| validate-openapi | 48 مسارًا · 54 عملية · مطابق |
| flutter analyze | No issues found |
| flutter test | 46/46 PASS (17 جديدة) |
| الصوت | BLOCKED — لا Dataset مرخّص + CDN محجوب في البيئة |
| النشر | NOT DEPLOYED |

## 2026-09-16 (تدقيق الإكمال النهائي)

| ما شُغّل | النتيجة |
|---|---|
| vitest (quran_api) | 72/72 PASS |
| flutter analyze/test | نظيف · 48/48 PASS |
| vitest (PWA) | 75/75 PASS |
| npm run build (PWA) | PASS — 388KB / gzip 129.59KB |
| integrity:final (نصّي) | PASS 41/41 · 0 discrepancy |
| integrity (json) | PASS 30/30 |
| OpenAPI contract | 48 مسارًا · 54 عملية · مطابق |
| مسح كل عائلات النقاط حيًّا (37 نداء) | PASS |
| CORS allow-list · 401 · 429 | PASS |
| فحص تسريب service_role | نظيف (لا وجود له في Flutter/PWA/OpenAPI/Git) |
| flutter build apk | BLOCKED — لا Android SDK (dl.google.com محجوب) |
| النشر | BLOCKED — لا DATABASE_URL |
| PRODUCTION READY | NO |
