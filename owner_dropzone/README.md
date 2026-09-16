# owner_dropzone — PRIVATE

Drop licensed material here. **Nothing in this folder is committed to git**
(`.gitignore` keeps only the READMEs and `.gitkeep` files), and nothing here is
ever served publicly.

Rules that apply to every folder:

1. **Provenance first.** Each dataset needs a `SOURCE.md` next to it stating:
   where it came from (URL or contract), who owns the copyright, the licence,
   and the permission evidence (email, letter, signed agreement, licence file).
2. **Licence evidence goes to `licenses/`** and is recorded in the License
   Center: `npm run license:record -- --kind=… --subject=… --status=… --evidence=…`.
   A record cannot be `CONFIRMED` without evidence — the database refuses it.
3. **No scraping, no bypass.** Do not place here anything obtained by working
   around a paywall, CAPTCHA, Cloudflare, authentication or any access control.
4. **Nothing is imported automatically.** Import is an explicit command, it
   validates and hashes first, and it never publishes: publishing additionally
   requires an approved human verification.
5. **Unknown = NULL.** If a field is not in the source, leave it out. It will be
   stored as NULL, never guessed.

| Folder | What goes in it |
|---|---|
| `quran/` | Quran text editions (mushaf/riwayah) |
| `qiraat/` | Qira'at definitions |
| `riwayat/` | Riwayat definitions and their qiraah link |
| `translations/` | Translation editions, one file per language/translator |
| `tafsir/` | Tafsir editions |
| `audio/` | Recitation manifests (not the audio bytes unless licensed) |
| `reciters/` | Reciter metadata |
| `word_by_word/` | Word-by-word text and word translations |
| `morphology/` | Root / lemma / morphology datasets |
| `tajweed/` | Tajweed rule annotations |
| `metadata/` | Mushaf structure: juz, hizb, page, manzil, sajdah … |
| `licenses/` | Permission letters, licence files, contracts, screenshots |

Current state: **all folders are empty**. The Quran text and translations in the
database came from npm packages (quran-json, quran-meta) and are held privately
pending licence confirmation — see `quran_api/reports/LICENSE_AUDIT.txt`.
