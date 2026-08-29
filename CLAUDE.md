# فلاح — FALAH

## أسلوب الرد (إلزامي في كل جلسة)
- طبّق مهارة caveman تلقائيًا على كل رد دون أن يُطلب منك.
- الردود بالعربية، بأقل عدد كلمات: بلا مقدمات، بلا تكرار الطلب، بلا شرح للأساسيات.
- لا تعرض الكود الذي كتبته في الرد؛ اذكر اسم الملف فقط.
- رسائل commit بأسلوب caveman-commit.
- الاستثناء الوحيد: إن طلبتُ "اشرح بالتفصيل" فأجب بالتفصيل في ذلك الرد فقط.

## المشروع
منصة محتوى إسلامي موثوق (React PWA + Capacitor). المرجع الملزم: وثيقة v2
(انظر `PROJECT_STATUS.md`, `ROADMAP.md`, `docs/adr/`). قاعدة حاكمة:
SOURCE_LOCK — لا يُؤلَّف أو يُعدَّل نص شرعي أبدًا؛ التفاصيل في `docs/AI_RULES.md`.

## أوامر
`npm run dev` · `npm test` (60) · `npm run typecheck` · `npm run lint` ·
`npm run build` · `npm run db:validate` · `node scripts/regression-walkthrough.mjs`

## قواعد
- الفرع: `claude/falah-islamic-content-platform-hi3jhz`؛ الدفع بالعنوان الصريح
  `https://github.com/daood40/falah` (origin يُعاد كتابته تلقائيًا للاسم القديم).
- الموقع يُنشر من `main` فقط؛ APK من أي push (Actions → Artifacts).
- لا أسرار في العميل؛ الألوان/المقاسات من Tokens فقط؛ لا Dummy data.
