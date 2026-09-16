# morphology/ — Root / lemma / morphology (PRIVATE)

**Required file**: `morphology.json`
```json
[{ "surah": 1, "ayah": 1, "position": 1, "root": "سمو", "lemma": "اسم",
   "morphology": { "pos": "N", "case": "GEN" } }]
```

**License required**: explicit — most morphology corpora carry research
licences with conditions.
**Verification**: positions must match existing `quran.ayah_words` rows.
**Import**: `quran.ayah_words.morphology` (jsonb) + `root`/`lemma` columns.
