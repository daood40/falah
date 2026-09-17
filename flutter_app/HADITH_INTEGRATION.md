# تكامل FALAH مع Hadith API

التطبيق **مستهلك** للـAPI فقط: لا SQL، ولا نسخة ثانية من المجموعة، ولا نص شرعي
داخل الكود أو ملفات التطبيق. كل نص يظهر للمستخدم إمّا من ملف الترجمة أو من
استجابة الخادم.

## 1. الإعداد من البيئة (بلا تعديل كود)

| المتغيّر | الافتراضي | المعنى |
|---|---|---|
| `FALAH_API_BASE_URL` | `http://127.0.0.1:8787` | عنوان الـAPI |
| `FALAH_API_TIMEOUT_SECONDS` | `15` | مهلة الطلب |
| `FALAH_API_PAGE_SIZE` | `20` | حجم الصفحة (الخادم يسقفه عند 100) |

```bash
# تطوير
flutter run  --dart-define=FALAH_API_BASE_URL=http://127.0.0.1:8799

# staging
flutter build apk --dart-define=FALAH_API_BASE_URL=https://api.staging.falah.app

# إنتاج
flutter build apk --dart-define=FALAH_API_BASE_URL=https://api.falah.app
```

بناء الإنتاج يرفض عنوانًا غير `https` أو موجّهًا إلى localhost
(`isUsableApiBaseUrl` في `lib/features/hadith/data/hadith_providers.dart`).

## 2. المسارات والشاشات

| الشاشة | المسار | نقاط النهاية |
|---|---|---|
| الكتب | `/hadith` | `GET /books` · `GET /version` |
| الأبواب | `/hadith/book/:bookId` | `GET /books/{id}/chapters` |
| أحاديث كتاب | `/hadith/book/:bookId/hadiths` | `GET /books/{id}/hadiths` |
| أحاديث باب | `/hadith/chapter/:chapterId` | `GET /chapters/{id}/hadiths` |
| كل الأحاديث | `/hadith/all` | `GET /hadiths` |
| تفاصيل الحديث | `/hadith/item/:id` | `GET /hadiths/{id}?include=…` |
| البحث | `/hadith/search` | `GET /search?q=` |
| حالة الخدمة | (داخلي) | `GET /health` |

## 3. الترقيم

الصفحة الأولى تُطلب مرة واحدة، والتالية عند بلوغ آخر القائمة أو بزر «تحميل
المزيد». العناصر تتراكم ولا تُستبدل، والفشل في صفحة تالية لا يمسح ما هو معروض؛
يظهر سطر خطأ مع زر إعادة المحاولة أسفل القائمة.

## 4. الكاش

`HadithCache` (من حزمة العميل) + `HadithCacheStore` (تخزين في
`shared_preferences`). القواعد:

- السجل يُخدم من الكاش فقط ما دام `dataset_version` هو نفسه الذي يخدمه الخادم
  **و** بصمته `content_hash` ما زالت مطابقة.
- تغيّر بصمة المجموعة (`/version`) ⇒ يُفرَّغ الكاش كاملًا، لا مزج بين مجموعتين.
- الكاش يحفظ الاستجابة كما وصلت ويستعيدها كما هي؛ لا إعادة صياغة ولا اشتقاق.
- عمر افتراضي 30 يومًا، والقوائم لا تُخزَّن — التخزين للسجل الواحد فقط.

## 5. الأخطاء وحالات الشبكة

كل شاشة لها الحالات الأربع (تحميل/فراغ/خطأ/بيانات) عبر `hadithAsync` في
`hadith_states.dart`، والرسالة تُشتق من رمز الخطأ:

| الرمز | الرسالة |
|---|---|
| `NETWORK_ERROR` | لا يمكن الوصول إلى الخادم… |
| `NOT_FOUND` | لم يُعثر على هذا السجل |
| `RATE_LIMITED` | طلبات كثيرة… |
| `VALIDATION_ERROR` / `BAD_REQUEST` | طلب غير صالح |
| `INTERNAL_ERROR` / 5xx | الخدمة غير متاحة الآن |

**ملاحظة تقنية مهمة:** Riverpod 3 يعيد المحاولة تلقائيًا ويُبقي الحالة
«تحميل» مع إرفاق الخطأ، فلو اعتمدت الشاشة على `isLoading` لظلّت تدور بلا نهاية
بدل إظهار الخطأ. لذلك أُوقفت إعادة المحاولة التلقائية (`retry: _noAutoRetry`)
وصار الخطأ يسبق التحميل في العرض.

## 6. المحتوى الشرعي

بوابة الترخيص مغلقة على الخادم، فحقل `text` يعود `null` مع
`text_available:false`. التطبيق يعرض إشعارًا صريحًا ولا يضع نصًا بديلًا ولا
يخزّن نصًا محليًا. لا يوجد أي نص حديث مكتوب داخل كود التطبيق.

## 7. تشغيل الاختبارات

```bash
# وحدات + عقد + تكامل من داخل التطبيق (85 اختبارًا)
flutter test --dart-define=FALAH_LIVE_API=http://127.0.0.1:8799

# قيادة التطبيق الحقيقي في متصفح (10 خطوات + لقطات)
flutter build web --dart-define=FALAH_API_BASE_URL=http://127.0.0.1:8799
(cd build/web && python3 -m http.server 8088) &
node test_e2e/drive_hadith.mjs http://127.0.0.1:8088 build/e2e
```
