# quran/ — Quran text editions (PRIVATE)

**Required file**: one JSON (or CSV/TXT) per edition, e.g. `hafs-uthmani.json`.

**Format** (JSON, UTF-8, no BOM):
```json
{
  "edition": {
    "slug": "kfc-hafs-uthmani",
    "name": "مصحف المدينة — حفص عن عاصم",
    "riwayah_slug": "hafs",
    "qiraah_slug": "asim",
    "script_type": "uthmani",
    "publisher": "…", "country": "…", "version": "…"
  },
  "surahs": [{ "surah_number": 1, "name_ar": "…", "ayah_count": 7 }],
  "ayahs":  [{ "surah": 1, "ayah": 1, "text": "…" }]
}
```
`text` must be the source text **verbatim** — no normalisation, no Unicode
normalisation, no whitespace tidying. Anything the source does not carry
(bismillah text, simple text, sajdah ruling) is simply omitted.

**Source**: name the publisher/authority and the exact file or contract.
**License required**: written redistribution permission, or a licence that
grants it explicitly. Scripture text is treated as licensable material here —
we do not assume it is free to redistribute.
**Verification**: `npm run import -- --validate-only` (counts, numbering, gaps,
duplicates, Arabic content), then SHA-256 per ayah, then
`npm run integrity:final`, then a human verification.
**Import**: `npm run import -- --version=<YYYY.MM.DD-n> --publish`
(publishing still requires `npm run verify:human`).
