# FALAH Quran API

منصة بيانات القرآن الكريم لتطبيق FALAH: خط استيراد موثّق، تحقّق بالبصمات،
قاعدة PostgreSQL/Supabase مع RLS، وواجهة REST للقراءة فقط (`/api/v1`).

> **SOURCE_LOCK** — لا يُولَّد نص قرآني ولا يُعدَّل ولا يُصحَّح تلقائيًا أبدًا.
> كل حقل غير موجود في المصدر يبقى `NULL`. أي تغيير في البيانات = إصدار Dataset جديد.

> **PRIVATE MODE: ON** — `PRIVATE_MODE=true` هو الافتراضي: لا API عام، لا بيانات
> عامة، لا تنزيل، والخادم يستمع على `127.0.0.1` ويرفض الإقلاع في وضع عام بلا
> تراخيص مؤكدة. التفاصيل: `docs/PRIVATE_DOCUMENTATION.md` و`docs/LICENSING.md`،
> والقائمة المطلوبة منك في `OWNER_LICENSE_CHECKLIST.md`.

---

## 1. Architecture

```
Trusted source packages (npm, versioned + licensed)
        │  quran-json@3.1.2 (Uthmani text + 10 translations, CC BY-SA 4.0)
        │  quran-meta@6.0.17 (Hafs mushaf structure, MIT)
        ▼
IMPORT ── PARSE ── VALIDATE ── HASH(SHA-256) ── IMPORT ── VERIFY ── PUBLISH
        ▼
PostgreSQL (schema `quran`, RLS on every table)
        ▼
REST API  /api/v1   (read-only, licence-gated, rate-limited)
        ▼
Flutter (Riverpod · Clean Architecture · Repository pattern · offline cache)
```

Flutter and the browser never talk to a source website: they read this API,
which reads the database. Nothing is fetched from a source at request time.

| Layer | Path |
|---|---|
| Migrations | `supabase/migrations/0003_quran_platform.sql` |
| Config / licence flags | `src/config/env.ts` |
| HTTP (router, CORS, headers, rate limit, auth) | `src/http/`, `src/app.ts` |
| Routes | `src/routes/` |
| Repositories (SQL) | `src/repositories/` |
| Import pipeline | `src/import/` |
| OpenAPI | `openapi/openapi.yaml` |
| Tests | `tests/` |
| Flutter integration | `../flutter_app/lib/features/quran_api/` |

## 2. Database

Schema `quran` (isolated from the legacy v1/v2 tables in `public`), 31 tables:

- **Registry / versions**: `sources`, `quran_editions`, `quran_dataset_versions`
- **Qira'at**: `qiraat`, `riwayat`, `reciter_riwayat`
- **Text**: `surahs`, `ayahs` (raw_text + content_hash + source_locked trigger)
- **Structure**: `juzs`, `hizbs` (rub al-hizb rows), `pages`, `manzils`
- **Translations**: `translations`, `ayah_translations`
- **Audio**: `reciters`, `recitations`, `audio_files`
- **Prepared architecture (empty until a trusted source exists)**:
  `tafsir_sources`, `ayah_tafsirs`, `revelation_contexts`, `ayah_words`,
  `topics`, `ayah_topics`
- **User**: `user_bookmarks`, `user_favorites`, `user_reading_progress`,
  `user_favorite_reciters`, `user_audio_progress`, `user_quran_settings`
- **Ops**: `import_runs`, `audit_logs`

Indexes: unique keys per edition, B-tree on juz/hizb/rub/page/manzil, GIN
tsvector for full-text search, GIN `pg_trgm` for partial matching.

### Source lock

`quran.ayahs.raw_text` is protected by the `ayahs_source_lock` trigger: any
`UPDATE` that changes it raises `SOURCE_LOCK: raw_text is immutable`. Derived
columns (`search_text`, `search_skeleton`) may change; the text may not.

## 3. Sources & licensing

| Source | Content | Licence | Status |
|---|---|---|---|
| `quran-json@3.1.2` | Uthmani text (from quranenc.com) + 10 translations (tanzil.net / quranenc.com) | **conflicting**: `package.json` says CC-BY-4.0, `LICENSE.txt`/README say CC-BY-SA-4.0 | **restricted** — redistribution NOT confirmed |
| `quran-meta@6.0.17` | Hafs mushaf structure: juz, hizb quarter, page, manzil, ruku, sajdah, surah metadata | MIT | approved |

The licence conflict is documented with evidence in `reports/LICENSE_AUDIT.txt`.
Until the owner resolves it, the text and all 10 translations are treated as
LICENSE_PENDING: imported for internal/staging use, never served publicly.

Attribution text is stored per source and returned by `GET /api/v1/sources`.
No site was scraped; no protection was bypassed; both datasets are published
npm packages installed as dependencies.

### Private mode and licence flags

| Flag | Default | Effect |
|---|---|---|
| `PRIVATE_MODE` | `true` | forces the three public switches off, binds to loopback, answers `451` to anonymous content requests |
| `CONTENT_LICENSE_CONFIRMED` | `false` | offline text download stays disabled |
| `TRANSLATIONS_LICENSE_CONFIRMED` | `false` | translations stay internal (`LICENSE_PENDING`) |
| `AUDIO_LICENSE_CONFIRMED` | `false` | audio `download_url` is withheld |
| `TAFSIR_LICENSE_CONFIRMED` | `false` | reserved for tafsir data |
| `QIRAAT_LICENSE_CONFIRMED` | `false` | reserved for additional qiraat datasets |
| `DATA_REDISTRIBUTION_ALLOWED` | `false` | nothing may leave the system |
| `PUBLIC_DATA_ENABLED` | `false` | content endpoints stay authenticated-only |
| `PUBLIC_API_ENABLED` | `false` | the API is internal |

The License Center (`quran.license_records`, `npm run license:list`,
`GET /api/v1/licenses`) records the evidence behind each of these claims, and
`npm run release:gate` is the single gate that decides whether anything may go
public. It is `BLOCKED` today.

## 4. Import pipeline

```bash
npm run import -- --validate-only              # parse + validate, no writes
npm run import -- --dry-run                    # same, reports what would be written
npm run import -- --version=2026.09.16-1 \
                  --translations=en,fr,tr,ur,id,es,ru,sv,bn,zh --publish
npm run verify                                 # re-verify hashes against the source
npm run integrity -- --out=reports/integrity-report.json
```

Every run prints a report with real counters (`imported/failed/skipped/
duplicates/invalid/missing/verified`) and writes an `audit_logs` row. The whole
import is one transaction: a failed validation writes nothing.

### Audio import

Audio is never guessed. The manifest contract is
`schemas/audio-manifest.schema.json` (template: `schemas/audio-manifest.template.json`)
and it is enforced in code: a manifest missing the codec, bitrate, sample rate,
duration, file size, SHA-256, licence or attribution is **rejected before any
network call or database write**.

```bash
npm run import:audio -- manifest.json --validate-only   # schema check only
npm run import:audio -- manifest.json --dry-run         # + live URL checks, no writes
npm run import:audio -- manifest.json                   # verify + import
npm run import:audio -- manifest.json --no-network      # import as `pending`
```

Each URL is checked over HTTP (status, content type, declared size, SHA-256) and
`verified = true` is set **only** for files that passed. Unverified files are
never playable in the app, and `download_url` stays null while
`AUDIO_LICENSE_CONFIRMED=false`.

## 5. API

Base path `/api/v1`. Response envelope:

```json
{ "success": true, "data": {}, "meta": {} }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Resource not found" } }
```

Errors never carry SQL, stack traces, secrets or internal paths.
54 operations — see `openapi/openapi.yaml` (validated in CI against the router).

```
GET  /api/v1/health · /version · /openapi.yaml · /stats · /sources · /editions · /datasets
GET  /api/v1/surahs · /surahs/{id} · /surahs/{id}/ayahs · /surahs/{id}/audio
GET  /api/v1/ayahs/{id} · /ayahs/by-key/{surah}:{ayah} · /ayahs/{id}/audio
GET  /api/v1/juzs · /juzs/{n} · /juzs/{n}/ayahs
GET  /api/v1/hizbs · /hizbs/{n} · /hizbs/{n}/ayahs · /rubs/{n}/ayahs
GET  /api/v1/pages/{page} · /pages/{page}/ayahs · /manzils · /manzils/{n}/ayahs
GET  /api/v1/sajdahs · /search · /translations · /qiraat · /riwayat
GET  /api/v1/reciters[?search=] · /reciters/{id}[/riwayat|/recitations|
     /surahs|/surahs/{surah}|/juzs/{juz}|/full-quran] · /audio/search
GET  /api/v1/downloads/quran · /downloads/reciters/{id}/surah/{surah}
GET/POST/DELETE /api/v1/me/bookmarks · /me/favorites · /me/favorite-reciters
GET/PUT         /api/v1/me/progress · /me/audio-progress · /me/settings
```

### Search

`GET /api/v1/search?q=...` uses PostgreSQL full-text search over a derived,
documented normalisation (diacritics removed, hamza forms unified) plus an
alef-less *skeleton* index, so both the Uthmani spelling (`ٱلۡعَٰلَمِينَ`) and the
plain spelling (`العالمين`) match. `raw_text` itself is never normalised.
Filters: `surah, ayah, juz, hizb, page_number, riwayah, qiraah, language,
edition, exact` + `page`/`limit`.

### Pagination

Every list endpoint takes `page` and `limit`; `limit > API_MAX_LIMIT` (default
100) is rejected with `422 VALIDATION_ERROR`.

### Authentication & security

- `/me/*` requires a Supabase access token (`Authorization: Bearer <jwt>`,
  HS256 verified against `SUPABASE_JWT_SECRET`; `alg:none`, wrong secret,
  tampering and expiry are rejected).
- Every statement runs inside a transaction with `SET LOCAL ROLE anon |
  authenticated` and the JWT claims applied, so **RLS is the enforcement point**,
  not the API code.
- Public catalogue tables have a `SELECT` policy only — no role except
  `service_role` can write them.
- Security headers, CORS allow-list, fixed-window rate limiting, body size cap,
  and parameterised SQL everywhere (no string interpolation of user input).

## 6. Flutter integration

`flutter_app/lib/features/quran_api/`:

- `domain/models.dart` — `QuranSurah, QuranAyah, QuranJuz, QuranHizb, QuranPage,
  QuranTranslation, QuranReciter, QuranQiraah, QuranRiwayah, QuranRecitation,
  QuranAudioFile, QuranDownloadManifest, Paginated<T>`
- `data/` — `QuranApiClient` (envelope + typed errors), `QuranApiDataSource`,
  `AudioApiDataSource`, `QuranApiRepository`, `ReciterRepository`, `AudioRepository`
- `offline/quran_cache.dart` — offline cache over a `CacheStorage` port
  (in-memory implementation included; file/SQLite/Isar/Hive can be plugged in),
  re-verifies every cached ayah against its `content_hash` and drops entries
  from a superseded dataset version
- `audio/audio_player_service.dart` — play/pause/resume/stop/seek/next/previous/
  repeat/playlist over an `AudioBackend` port; the `just_audio` adapter is in
  `docs/FLUTTER_AUDIO.md` and is wired once audio licensing is confirmed
- `providers.dart` — Riverpod wiring; the API is used only when
  `--dart-define=QURAN_API_BASE_URL=...` is provided, otherwise the app keeps
  its bundled offline dataset

```dart
final repo = ref.watch(quranApiRepositoryProvider);
final ayah   = await repo.getAyah(2, 255);
final surah  = await repo.getSurah(18);
final hits   = await repo.search('الحمد لله');
final people = await ref.watch(reciterRepositoryProvider).getReciters();
final audio  = await ref.watch(audioRepositoryProvider).getAyahAudio(ayah.id);
```

## 6-bis. Human verification gate

Automated checks prove the stored bytes match the source. They cannot judge the
source. A dataset version therefore reaches `published` **only** after a named
person records an approved verification (migration 0004 enforces this with a
trigger — no importer, admin action or manual UPDATE can bypass it):

```bash
npm run verify:human -- --version=2026.09.16-1 --verifier="اسم المراجع" \
  --role="مراجع شرعي" --scope="عينة 200 آية + السجدات + حدود الأجزاء" \
  --sample=200 --result=approved --notes="..."
```

`GET /api/v1/version` reports the state (`human_verification.verified`), and
until then the dataset stays at `verified`.

## 7. Running it

```bash
cd quran_api
cp .env.example .env            # fill DATABASE_URL (+ SUPABASE_JWT_SECRET)
npm ci
npm run db:apply                # applies supabase/migrations/*.sql in order
npm run import -- --version=$(date +%Y.%m.%d)-1 --translations=en --publish
npm run serve                   # http://localhost:8787/api/v1/health
```

Or as a container:

```bash
docker build -t falah-quran-api .
docker run --rm -p 8787:8787 \
  -e DATABASE_URL=... -e SUPABASE_JWT_SECRET=... -e ENVIRONMENT=production \
  falah-quran-api
```

Clients: see `API_USAGE.md` and the runnable `examples/` (cURL, JavaScript,
TypeScript, Dart, Flutter, Python, PHP). No example hardcodes a host — they all
read `FALAH_API_BASE_URL`.

Requires Node 22.6+ (TypeScript is executed directly) and PostgreSQL 16 with
`pgcrypto` and `pg_trgm`.

## 8. Deployment

**Supabase**

1. `supabase db push` (or `npm run db:apply` with `DATABASE_URL` pointing at the
   project) applies `0001` → `0003`. Roles `anon`, `authenticated`,
   `service_role` and `auth.uid()` already exist there; the migration is
   idempotent about them.
2. Set the flags and secrets in the API host environment (never in the client).
3. Run the import from a trusted machine/CI with `DATABASE_URL` = the Supabase
   connection string.
4. Deploy this service (any Node 22 host, container or VM) with
   `ENVIRONMENT=production`, `API_CORS_ORIGINS` set, and a reverse proxy adding
   TLS. The API only needs a database URL and the JWT secret — no service role
   key is required for read traffic.

**Staging**: keep `PUBLIC_DATA_ENABLED=false`; internal testers authenticate with
Supabase and read content, anonymous callers get `451`.

## 9. Testing

```bash
npm run typecheck && npm run openapi:validate && npm test && npm run integrity
```

`npm test` creates a real database, applies all migrations, runs the real import
pipeline against the real source packages, then exercises the HTTP API, RLS,
source lock, search, pagination, auth, injection attempts, malformed bodies and
the OpenAPI contract. No mocked database and no fixture Quran text.

## 10. Reports

Committed evidence for `docs/GATES.md`:

| File | Produced by |
|---|---|
| `reports/import-report.json` | `npm run import -- …` |
| `reports/integrity-report.json` | `npm run integrity` |
| `reports/QURAN_FINAL_INTEGRITY.txt` | `npm run integrity:final` |
| `reports/LICENSE_AUDIT.txt` | licence evidence read from the packages |
| `reports/test-report.md` | the test runs themselves |
| `reports/FINAL_PRODUCTION_AUDIT.txt` | the final gate — currently PRODUCTION READY: NO |
