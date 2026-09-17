# FALAH Hadith API — TypeScript client

One file, zero dependencies, works in Node 18+, Deno, Bun and browsers.

```bash
cp falah-hadith.ts your-project/src/
```

```ts
import { HadithApi } from './falah-hadith.ts';

const api = new HadithApi('http://127.0.0.1:8787');

const stats = await api.stats();            // real counts
const page  = await api.hadiths({ limit: 20 });
const hits  = await api.search('إنما الأعمال بالنيات');
const books = await api.catalog({ chapters: true });
const checks = await api.crossChecks(page.items[0].id);

for (const h of page.items) {
  // null while the server withholds the text — never substitute anything
  if (h.text_available) console.log(h.raw_text);
  console.log(h.book?.name, h.volume, h.page, h.grading);
}
```

Errors arrive as `HadithApiError` with the API's own `code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, …).

Pass `adminKey` only from a server: it unlocks `/admin` routes and the
withheld text, and must never reach a browser bundle or a mobile app.
