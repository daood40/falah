# reciters/ — Reciter metadata (PRIVATE)

**Required file**: `reciters.json`
```json
[{ "slug": "…", "name_ar": "…", "name_en": "…", "country": null,
   "birth_year": null, "death_year": null, "bio": null, "photo_url": null,
   "website": null, "riwayah_slugs": ["hafs"], "source": "…" }]
```
Anything the source does not state stays `null` — biography, country, years and
photos are never guessed, and a reciter is never assumed to recite every riwayah.

**License required**: the metadata's licence, plus image rights for any photo.
**Verification**: riwayah links must resolve; the reciter is unverified until
its audio (if any) verifies.
**Import**: part of the audio manifest, or a standalone reciters import.
