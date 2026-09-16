# tajweed/ — Tajweed annotations (PRIVATE)

**Required file**: `tajweed.json`
```json
[{ "surah": 1, "ayah": 1, "start": 0, "end": 4, "rule": "…", "source": "…" }]
```
Offsets refer to the edition's verbatim text and must not require changing it.

**License required**: the annotation dataset's licence.
**Verification**: offsets inside the ayah text length; rules from a documented
rule set, not invented names.
**Import**: no table yet — the schema is added with the first licensed dataset
so it matches the real data instead of a guess.
