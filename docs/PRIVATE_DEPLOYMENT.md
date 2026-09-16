# PRIVATE_DEPLOYMENT — نشر داخلي فقط

> لا نشر عام. هذه التعليمات لتشغيل نسخة **خاصة** للتطوير أو الاختبار الداخلي.

## 1. محليًا (الأبسط)

```bash
cd quran_api
cp .env.example .env         # املأ DATABASE_URL و SUPABASE_JWT_SECRET
npm ci
npm run db:apply             # 0001 → 0005
npm run import -- --version=$(date +%Y.%m.%d)-1 --translations=en
npm run serve                # يستمع على 127.0.0.1:8787 (PRIVATE_MODE=true)
```

`PRIVATE_MODE=true` هو الافتراضي: الربط على loopback، ولا وصول مجهول للمحتوى
(451)، والأعلام العامة مُجبَرة على false مهما كتبت في البيئة.

## 2. حاوية خاصة

```bash
docker build -t falah-quran-api ./quran_api
docker run --rm -p 127.0.0.1:8787:8787 \
  -e DATABASE_URL=… -e SUPABASE_JWT_SECRET=… \
  -e PRIVATE_MODE=true -e ENVIRONMENT=staging \
  -e HOST=0.0.0.0 \
  falah-quran-api
```

`-p 127.0.0.1:8787:8787` يربط المنفذ بالجهاز فقط. لا تنشر المنفذ على 0.0.0.0
للشبكة العامة، ولا تضع الخدمة خلف اسم نطاق عام.

## 3. بيئة خاصة على خادم (اختياري)

- شبكة خاصة/VPN أو قائمة IP مسموح بها فقط.
- TLS إلزامي حتى داخليًا.
- المصادقة إلزامية: `/me/*` دائمًا، والمحتوى كذلك ما دام `PUBLIC_DATA_ENABLED=false`.
- لا تُعرض قاعدة البيانات مباشرة للإنترنت؛ الاتصال من الخدمة فقط.
- Storage: buckets خاصة فقط — لم يُستخدم أي تخزين حتى الآن.
- النسخ الاحتياطي: مشفّر وخاص، ولا يُرفع إلى أي مكان عام.

## 4. الأسرار

من البيئة فقط: `DATABASE_URL`, `SUPABASE_JWT_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY` (للخادم/الاستيراد فقط). لا تُوضع في Flutter ولا في
الـPWA ولا في git ولا في OpenAPI ولا في السجلات. يوجد فحص آلي:
`./scripts/secret-scan.sh` (يعمل في CI ويفشل عند أي تسريب).

## 5. السجلات

تُسجَّل الحالة فقط (المنفذ، البيئة، وضع الخصوصية). لا تُطبع أسرار ولا روابط
قاعدة البيانات ولا نصوص المحتوى.

## 6. متى يصبح النشر عامًا

عندما يعطي `npm run release:gate` النتيجة `ALLOWED` — لا قبل ذلك. راجع
`docs/LICENSING.md` و`OWNER_LICENSE_CHECKLIST.md`.
