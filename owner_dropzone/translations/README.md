# translations/ — Translations (PRIVATE, licence-critical)

**Required file**: one file per translation, e.g. `en-saheeh.json`
```json
{
  "translation": {
    "slug": "en-saheeh", "language": "en", "title": "…",
    "translator": "…", "publisher": "…", "version": "…"
  },
  "entries": [{ "surah": 1, "ayah": 1, "text": "…" }]
}
```

**Source**: the exact edition and where it came from.
**License required**: permission from the translator or the publisher —
**not** from whoever packaged the file. A packager's licence does not transfer
a translator's rights. Until that exists the translation stays
`LICENSE_PENDING` and is never served publicly.
**Verification**: 6,236 entries (or the source's own count), no duplicates, no
empty text, SHA-256 per entry, every ayah reference resolvable.
**Import**: `npm run import -- --translations=<slug,…> --version=…`
**AI**: never used to translate, correct or reword. Ever.
