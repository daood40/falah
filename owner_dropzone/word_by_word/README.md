# word_by_word/ — Word-by-word data (PRIVATE)

**Required file**: `word-by-word-<lang>.json`
```json
[{ "surah": 1, "ayah": 1, "position": 1, "text": "بِسۡمِ",
   "translation": "In (the) name", "root": null, "lemma": null }]
```
`position` starts at 1 and must be contiguous within an ayah.

**License required**: these datasets are usually licensed works — permission
required before import.
**Verification**: word positions contiguous, every ayah reference resolvable,
word text consistent with the ayah text of the same edition.
**Import**: table `quran.ayah_words` is ready.
