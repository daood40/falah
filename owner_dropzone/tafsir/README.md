# tafsir/ — Tafsir (PRIVATE)

**Required file**: one file per tafsir edition, e.g. `saadi-ar.json`
```json
{
  "source": { "slug": "saadi", "title": "تيسير الكريم الرحمن", "author": "…",
              "language": "ar", "edition": "…", "version": "…" },
  "entries": [{ "surah": 1, "ayah": 1, "text": "…", "reference": "…" }]
}
```

**License required**: explicit permission; classical texts still have modern
edited editions with their own rights.
**Verification**: ayah references resolvable, SHA-256 per entry, no empty text.
**Import**: tables `quran.tafsir_sources` + `quran.ayah_tafsirs` are ready; the
importer for them is added when the first licensed dataset arrives.
**AI**: never used to write, summarise or "improve" tafsir.
