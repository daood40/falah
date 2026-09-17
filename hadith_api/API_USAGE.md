# Hadith API — دليل الاستخدام

قاعدة الوصول: `{BASE}/api/v1` · المواصفة: `{BASE}/openapi.yaml` · فهرس الموارد: `{BASE}/`

القراءة **بلا مفتاح**. مسارات `/admin/*` وحدها تحتاج `Authorization: Bearer <ADMIN_API_KEY>`
وتُستدعى من خادم فقط.

كل استجابة: `{ "success": true, "data": …, "meta": … }` — والخطأ:
`{ "success": false, "error": { "code": …, "message": … } }`.

> **النص المحجوب**: ما دام `CONTENT_LICENSE_CONFIRMED=false` فحقل `text` يعود `null`
> مع `text_available:false`. هذه حالة صحيحة لا خطأ — اعرض رسالة، ولا تضع نصًّا بديلًا.

---

## cURL

```bash
BASE=http://127.0.0.1:8787

curl -s "$BASE/api/v1/health"
curl -s "$BASE/api/v1/version"
curl -s "$BASE/api/v1/hadiths?limit=20&page=1"
curl -s "$BASE/api/v1/hadiths/$ID?include=gradings,takhrij,verification"
curl -s "$BASE/api/v1/search?q=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("الصلاة"))')&limit=20"
curl -s "$BASE/api/v1/catalog?chapters=true"
curl -s "$BASE/api/v1/hadiths/daily"

# إداري (من خادم فقط)
curl -s -H "Authorization: Bearer $ADMIN_API_KEY" "$BASE/api/v1/admin/stats"
```

## JavaScript (fetch — متصفح أو Node 18+)

```js
const BASE = 'http://127.0.0.1:8787';

async function api(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const body = await res.json();
  if (!body.success) throw new Error(`${body.error.code}: ${body.error.message}`);
  return body;
}

const { data: page, meta } = await api('/api/v1/hadiths', { limit: 20 });
console.log(`${meta.current_page}/${meta.total_pages} من ${meta.total}`);
for (const h of page) {
  console.log(h.id, h.volume, h.page, h.text_available ? h.text : '— النص محجوب —');
}
```

## TypeScript

عميل جاهز بلا تبعيات: `clients/typescript/falah-hadith.ts`

```ts
import { HadithApi } from './falah-hadith.ts';

const api = new HadithApi('http://127.0.0.1:8787');
const page = await api.hadiths({ limit: 20 });
const hit = await api.search('إنما الأعمال بالنيات');
const checks = await api.crossChecks(page.items[0].id);
```

## Dart

حزمة رسمية: `clients/dart` (‏`falah_hadith_api`)

```dart
import 'package:falah_hadith_api/falah_hadith_api.dart';

final repo = HadithRepository(HadithApiClient(baseUrl: 'http://127.0.0.1:8787'));

final page = await repo.getHadiths(limit: 20);
final hadith = await repo.getHadith(page.items.first.id, include: ['gradings', 'verification']);
final daily = await repo.getDailyHadith();
```

## Flutter

```dart
// flutter run --dart-define=FALAH_API_BASE_URL=https://api.falah.app
final repo = ref.watch(hadithRepositoryProvider);
final books = await repo.getCatalog(withChapters: true);

// كاش يحترم بصمة المجموعة
final cache = HadithCache();
cache.syncDataset(await repo.getVersion());   // بصمة جديدة ⇒ إفراغ الكاش
final cached = cache.get(id) ?? await repo.getHadith(id)..let(cache.put);
```

## Python

```python
import requests

BASE = "http://127.0.0.1:8787"

def api(path, **params):
    r = requests.get(f"{BASE}{path}", params=params, timeout=15)
    body = r.json()
    if not body.get("success"):
        raise RuntimeError(f"{body['error']['code']}: {body['error']['message']}")
    return body

page = api("/api/v1/hadiths", limit=20)
for h in page["data"]:
    print(h["id"], h["volume"], h["page"], h["text"] if h["text_available"] else "— محجوب —")

hits = api("/api/v1/search", q="الصلاة", limit=20)
print(hits["meta"]["total"], "نتيجة")
```

## PHP

```php
<?php
$base = 'http://127.0.0.1:8787';

function api(string $path, array $params = []): array {
    global $base;
    $url = $base . $path . (empty($params) ? '' : '?' . http_build_query($params));
    $body = json_decode(file_get_contents($url), true);
    if (!($body['success'] ?? false)) {
        throw new RuntimeException($body['error']['code'] . ': ' . $body['error']['message']);
    }
    return $body;
}

$page = api('/api/v1/hadiths', ['limit' => 20]);
foreach ($page['data'] as $h) {
    echo $h['id'], ' ج', $h['volume'], ' ص', $h['page'], ' ',
         $h['text_available'] ? $h['text'] : '— محجوب —', PHP_EOL;
}
```

---

## الترقيم

`?page=&limit=` بسقف 100 (ما فوقه 422). الـmeta:
`page` · `current_page` · `limit` · `total` · `total_pages`.

## البحث

`q` (حرفان فأكثر) · `type=hadiths|narrators|chapters|books` · `book_id` ·
`chapter_id` · `source_id` · `grading` · `volume` · `page_number` · `page` · `limit`.

البحث يطبّع التشكيل والهمزات والأرقام الهندية للمطابقة فقط — **النص المخزَّن لا يتغيّر**.

## الأخطاء

| الرمز | HTTP | متى |
|---|---|---|
| `VALIDATION_ERROR` | 422 | مُعامل غير صالح، أو `limit` فوق السقف |
| `NOT_FOUND` | 404 | لا سجل بهذا المعرّف |
| `UNAUTHORIZED` | 401 | مسار إداري بلا مفتاح صالح |
| `RATE_LIMITED` | 429 | تجاوز الحد — انظر `Retry-After` |
| `BAD_REQUEST` | 400 | جسم JSON تالف أو أكبر من 64KB |
| `INTERNAL_ERROR` | 500 | خطأ داخلي — بلا تفاصيل داخلية في الرد |

## التخزين المؤقت

خزّن `dataset_hash` من `/api/v1/version`. تغيّره ⇒ المجموعة تغيّرت ⇒ أفرغ الكاش.
لكل سجل خزّن `content_hash`؛ اختلافه عن ما يعيده الخادم ⇒ ارفض النسخة المخزَّنة.

## الحدود

120 طلبًا لكل IP في الدقيقة افتراضيًا (`RATE_LIMIT_MAX`) · `limit` ≤ 100 ·
جسم الطلب ≤ 64KB.
