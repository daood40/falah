# qiraat/ — Qira'at (PRIVATE)

**Required file**: `qiraat.json`
```json
[{ "slug": "asim", "name_ar": "قراءة عاصم بن أبي النجود", "name_en": "Asim",
   "description": "…", "source": "…" }]
```
Only qira'at documented by the source. Nothing is added by inference.

**License required**: whatever covers the dataset you take the names and
descriptions from (metadata is still someone's work).
**Verification**: each riwayah must link to an existing qiraah; the database
enforces the foreign key.
**Import**: extend `src/import/registry.ts` (QIRAAT) or supply the file and run
the import; both paths record the source id.
