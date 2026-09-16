# metadata/ — Mushaf structure (PRIVATE)

**Required file**: `structure-<edition>.json`
```json
{
  "edition_slug": "…",
  "juz":    [{ "number": 1, "start": [1, 1], "end": [2, 141] }],
  "hizb":   [{ "number": 1, "quarter": 1, "start": [1, 1], "end": [2, 25] }],
  "pages":  [{ "number": 1, "start": [1, 1], "end": [1, 7] }],
  "manzil": [{ "number": 1, "start": [1, 1], "end": [4, 176] }],
  "sajdah": [{ "surah": 7, "ayah": 206, "type": null }]
}
```
Page numbering is edition-specific: never reuse another mushaf's pages.

**License required**: the dataset's licence (currently quran-meta, MIT —
CONFIRMED in the License Center).
**Verification**: divisions must cover every ayah with no gap or overlap, and
every ayah's own juz/hizb/page/manzil must agree with the boundaries.
**Import**: the current importer reads this from quran-meta; a file here
replaces that source for a new edition.
