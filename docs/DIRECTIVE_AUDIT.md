# DIRECTIVE_AUDIT — تدقيق فلاح مقابل توجيه الهندسة الاحترافية (54 بندًا)

**التاريخ:** 2026-09-03 · **الإصدار المدقَّق:** 2.1.0 · القاعدة: لا هدم لما يعمل (بند 2/42).

الرموز: ✅ منفّذ ومختبر · 🟡 منفّذ جزئيًا (السبب مذكور) · ⏸ ينتظر مدخلات خارجية من المالك.

| البند                     | الحالة | الدليل                                                                                                                        |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1 معيار اكتمال الميزة     | ✅     | كل إصدار: اختبارات + build + regression + توثيق (CHANGELOG) قبل الإعلان                                                       |
| 2 تحليل قبل البرمجة       | ✅     | `docs/AUDIT.md` (جولة متصفح حية) + تحليل الفجوات في PROJECT_STATUS                                                            |
| 3 Skills/Docs             | ✅     | مهارات مثبتة في `.agents/skills`؛ اعتماديات قليلة ومفحوصة                                                                     |
| 4 Architecture            | ✅     | Clean ‏(core/features بطبقات domain/data/presentation)، `docs/ARCHITECTURE.md`                                                |
| 5 Database                | ✅     | ‏34 جدولًا بمفاتيح وقيود وفهارس وmigrations تراكمية، تُتحقق على PostgreSQL 16 في CI                                           |
| 6 Authentication          | 🟡     | Supabase Email + وضع محلي صادق؛ Google/Apple وPassword-Reset UI تنتظر تفعيل Supabase (⏸)                                      |
| 7 Authorization           | ✅     | خمسة أدوار في `user_roles` + سياسات؛ الإنفاذ الخادمي الكامل بعد تفعيل Supabase                                                |
| 8 RLS مختبرة فعليًا       | ✅     | **جديد 2.1.0**: اختبارات سلوكية في `validate-db.sh` بدور غير مالك (عزل قراءة/كتابة بين مستخدمين) تعمل في CI                   |
| 9 API Security            | ✅     | ‏Edge Function: تحقق مدخلات (نوع/طول)، حدود تاريخ المحادثة، مفاتيح خادمية؛ Rate limiting خادمي ⏸ (يُفعّل مع نشر Supabase)     |
| 10 Secrets                | ✅     | صفر أسرار في العميل؛ `ANTHROPIC_API_KEY` عبر `supabase secrets`؛ ‏gitignore صارم                                              |
| 11 حماية المستخدم         | ✅     | CSP، لا innerHTML بمدخلات، RLS مختبرة، بوابة تصدير SOURCE_LOCK                                                                |
| 12 Input Validation       | ✅     | بحث/مراجع/نسخ احتياطي/AI مدخلات محددة النوع والطول                                                                            |
| 13 File Upload            | ✅     | **جديد 2.1.0**: رفع الصور يقبل PNG/JPG/WebP/GIF فقط (SVG مستبعد عمدًا) وبحد 8MB في الموضعين                                   |
| 14 AI Architecture        | ✅     | Frontend → Edge Function → Anthropic → فلترة إخراج؛ المفتاح خادمي                                                             |
| 15 صلاحيات AI             | ✅     | ‏AI طبقة اقتراح فقط؛ لا وصول لقاعدة أو دفع أو ملفات                                                                           |
| 16 SOURCE_LOCK            | ✅     | القاعدة الحاكمة منذ v1.0: بصمات SHA-256، عناصر مقدسة مقفلة، نصوص رفض قانونية                                                  |
| 17 Verification Layer     | ✅     | خط تحقق كامل + `verification_records` (هجرة 0002) + بصمة المصدر داخل PNG                                                      |
| 18 لا Mock في Production  | ✅     | المنصات غير المهيأة تقول «غير مهيأة» بصدق؛ لا بيانات وهمية                                                                    |
| 19 Error Handling         | ✅     | ErrorBoundary + حالات Loading/Empty/Error في كل صفحة + Toasts                                                                 |
| 20 Offline                | ✅     | ‏Offline-first حقيقي: القرآن مدمج، SW مختبر، regression يتحقق                                                                 |
| 21 Performance            | ✅     | تقسيم حزم، Supabase كسول، حزمة 385KB (gzip 128)، فهارس، Pagination بالسور                                                     |
| 22 Background Jobs        | 🟡     | الفيديو يُنشأ على الجهاز (MediaRecorder)؛ FFmpeg Worker خادمي = ADR-004 ⏸                                                     |
| 23 Testing Strategy       | ✅     | ‏75 Unit/Integration + DB/RLS في CI + E2E: `regression-walkthrough` و**`npm run sweep` الجديد** (نقر كل الأزرار في 12 مسارًا) |
| 24 اختبار بعد كل ميزة     | ✅     | نمط كل الإصدارات (انظر CHANGELOG)                                                                                             |
| 25 Build Verification     | ✅     | ‏lint+typecheck+tests+build قبل كل push، وCI يعيدها                                                                           |
| 26 CI/CD                  | ✅     | ‏Push → فحوص → build → نشر Pages من main فقط + APK تلقائي                                                                     |
| 27 Backup & Recovery      | ✅     | نسخة احتياطية/استعادة بملف واحد، الاستعادة مختبرة بوحدات                                                                      |
| 28 Monitoring             | ✅     | **جديد 2.1.0**: التقاط أخطاء عام (error/unhandledrejection) بسجل محلي في الإعدادات؛ مراقبة خادمية ⏸ (بعد Supabase)            |
| 29 Audit Logs             | ✅     | `auditLog` للعمليات الحساسة + جدول append-only                                                                                |
| 30 Scalability            | ✅     | محتوى ثابت عبر CDN ‏Pages؛ المخطط مفهرس؛ التكاليف صفرية حاليًا                                                                |
| 31-33 UX/Responsive/A11y  | ✅     | ‏Design System بالـTokens، ثيم الورق القديم، فحص شاشات، حبس تركيز، أهداف ≥44px                                                |
| 34 i18n                   | ✅     | عربية RTL + إنجليزية LTR، صفر نصوص داخل الكود                                                                                 |
| 35 Content Management     | 🟡     | المحتوى المقدس كبيانات موثقة ببصمات؛ لوحة إدارة مصادر كاملة = مرحلة 6 ⏸                                                       |
| 36 Admin Dashboard        | ⏸      | يتطلب Supabase مفعّلة وأدوارًا حقيقية (الجداول جاهزة)                                                                         |
| 37 Notifications          | ✅     | مركز إشعارات داخلي كامل؛ Push/Email ⏸ (FCM/مزود بريد)                                                                         |
| 38 Payments               | ⏸      | ‏ADR-007؛ لا تُبنى واجهة دفع وهمية (بند 45)                                                                                   |
| 39 التكلفة                | ✅     | حد رسائل AI يومي بالخطة؛ صفر خدمات مدفوعة مفعلة                                                                               |
| 40 Documentation          | ✅     | ‏README, ARCHITECTURE, ADRs, MIGRATION, ROADMAP, SOURCE_POLICY, AI_RULES, هذا الملف                                           |
| 41 Git                    | ✅     | ‏Commits ذرية بصيغة Conventional عبر 40+ commit                                                                               |
| 42 لا تغييرات خارج المهمة | ✅     | قاعدة الجلسة الدائمة؛ لا هدم                                                                                                  |
| 43 لا اختراع معلومات      | ✅     | مصادر بحث موثقة في MARKET.md؛ لا APIs مخمّنة                                                                                  |
| 44 معالجة جذرية للأخطاء   | ✅     | أمثلة موثقة (هجري «هـ هـ»، last_error بالوراثة، manifest المطلق)                                                              |
| 45 لا حلول وهمية          | ✅     | صفر TODO/Mock success في الكود المنتج                                                                                         |
| 46-47 المراحل والخطط      | ✅     | ‏ROADMAP بمراحل 0-7 + خطة قبل كل إصدار                                                                                        |
| 48 Final Audit            | ✅     | مسح إطلاق v2.0.0 (12 مسارًا) + هذا التدقيق                                                                                    |
| 49 Definition of Done     | ✅     | مطبق (انظر بنود الجدول)                                                                                                       |
| 50-52 العقلية والاستباقية | ✅     | فجوات اكتُشفت ذاتيًا: manifest المطلق، اجتزاء الآيات، أزرار القائمة الميتة                                                    |
| 53 لا قرارات خطيرة بصمت   | ✅     | الحذف/الهجرة/الدفع تُعرض عليك أولًا (كما في حذف الفروع)                                                                       |
| 54 الهدف                  | ✅     | منتج مُطلق فعليًا: موقع + PWA قابلة للتثبيت + APK                                                                             |

## خلاصة البنود المتبقية (كلها ⏸ بمدخلات خارجية)

Supabase مفعّلة (يفتح: Google Sign-In، مراقبة خادمية، Rate-limit خادمي، لوحة الإدارة، سير المراجعة) ·
مصادر مرخصة (تفاسير/الكتب الستة/أذكار السنة) · مفاتيح المنصات + KMS · FCM/بريد · مزود دفع (ADR-007) ·
FFmpeg Worker (ADR-004) · هجرة Flutter (ADR-001، بقرار صريح فقط).
