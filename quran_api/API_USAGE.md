# FALAH Quran API — usage guide

A standalone read-only REST API for Quran text, structure, translations and
(when licensed) recitation audio. It runs as its own service: any client —
Flutter, Android, iOS, web, Node, Python, PHP — talks to it over HTTPS. Nothing
in this guide requires the FALAH app or a developer machine to be running.

---

> **PRIVATE MODE.** This API is internal. There is no public base URL, no
> public dataset and no public download until the owner obtains every content
> licence. Anonymous requests to content endpoints answer `451`. Everything
> below describes how the API works for an internal caller, and how it will
> work once the licences land.

## 1. Base URL

```
<PUBLIC_API_BASE_URL>/api/v1
```

**Status: not deployed yet.** No public base URL exists, and this document will
not invent one. Once the owner deploys the service (see `README.md` §8) the URL
is fixed in exactly two places:

- server: `API_BASE_URL` in the service environment (used for documentation only),
- clients: `QURAN_API_BASE_URL` in `flutter_app/config/<env>.json` or your own config.

Rules for that URL: HTTPS only, a real hostname (e.g. `https://api.falah.app`),
never `localhost`, `127.0.0.1`, a LAN address or a tunnel. The API itself is
domain-agnostic: it builds no absolute URLs and stores no hostname.

For local development the service listens on `http://localhost:8787`.

## 2. Versioning

Everything lives under `/api/v1`. `v1` will not break: fields are added, never
removed or re-typed. A breaking change ships as `/api/v2` alongside `v1`, and
`GET /api/v1/version` keeps reporting the release that serves the request.

## 3. Authentication

| Traffic | Requirement |
|---|---|
| Content endpoints (`/surahs`, `/ayahs`, `/search`, …) | none once `PUBLIC_DATA_ENABLED=true`; while it is `false` a Supabase access token is required and anonymous callers get `451` |
| User endpoints (`/me/*`) | always `Authorization: Bearer <supabase access token>` |
| Writes of any kind to Quran data | impossible — the public API is read-only |

The token is a Supabase Auth access token (HS256). The API verifies the
signature and expiry itself and then runs every statement under PostgreSQL Row
Level Security as that user.

```bash
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "$BASE/api/v1/me/bookmarks"
```

## 4. Rate limits

Fixed window, per client IP: `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`
(defaults: 120 per 60s). Over the limit you get `429` with
`{"error":{"code":"RATE_LIMITED"}}`. Back off and retry; there is no penalty box.

## 5. CORS

`API_CORS_ORIGINS` is a comma-separated allow-list. Requests from a listed
origin get `Access-Control-Allow-Origin: <origin>`; others get no CORS header
(the data is still readable by non-browser clients). Leaving the list empty
allows any origin — use that only for a fully public deployment.

## 6. Response envelope

```json
{ "success": true,  "data": …, "meta": { … } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Resource not found" } }
```

Error codes: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), `VALIDATION_ERROR` (422),
`RATE_LIMITED` (429), `LICENSE_RESTRICTED` (451), `INTERNAL_ERROR` (500).
Errors never contain SQL, stack traces, secrets or internal paths.

## 7. Pagination

Every list endpoint takes `page` (≥1) and `limit` (≥1, ≤ `API_MAX_LIMIT`,
default 100). `meta` carries `page`, `limit`, `total`, `total_pages`.
`limit=1000000` is rejected with `422`, not silently clamped.

```bash
curl "$BASE/api/v1/surahs/2/ayahs?page=2&limit=50"
```

## 8. Search

```
GET /api/v1/search?q=الحمد+لله&surah=1&limit=20
```

PostgreSQL full-text search (GIN tsvector) over a derived, documented
normalisation, plus a `pg_trgm` index and an alef-less *skeleton* index so the
Uthmani spelling (`ٱلۡعَٰلَمِينَ`) and the plain spelling (`العالمين`) match each
other. `raw_text` is never normalised — only derived columns are.

Filters: `surah, ayah, juz, hizb, page_number, riwayah, qiraah, language,
edition, exact` plus `page`/`limit`. `exact=true` matches the normalised text as
a phrase.

## 9. Dataset versions and sources

- `GET /api/v1/version` — API release, dataset version, dataset status, source
  file SHA-256, and whether a human has approved that dataset.
- `GET /api/v1/datasets` — every imported version with its hash and status.
- `GET /api/v1/sources` — the source registry: licence, licence URL, attribution
  text and status for each dataset. **Display the attribution text** wherever you
  show the content.

A dataset is immutable: correcting anything means importing a new version, not
editing rows. `content_hash` (SHA-256) travels with every ayah so a client can
re-verify what it received.

## 10. Offline usage

`GET /api/v1/downloads/quran` returns a manifest: dataset version, checksum,
record count, size, and `downloadable` (false while redistribution rights are
unconfirmed). Clients should:

1. store the manifest with the cached data,
2. re-check each cached ayah's `content_hash` before serving it,
3. drop the cache when the dataset version changes,
4. refuse any downloaded dataset whose checksum does not match the manifest.

The Flutter client does exactly this (`features/quran_api/offline/quran_cache.dart`).

## 11. Security notes for integrators

- HTTPS only in production; the service expects to sit behind TLS termination.
- Never ship `SUPABASE_SERVICE_ROLE_KEY` (or any secret) in an app, a web bundle
  or a repository. Clients only ever need the base URL and a user access token.
- Treat the API as read-only. There is no endpoint that modifies Quran text,
  and the database refuses such an update even with full privileges.
- Send `Accept: application/json`; responses are UTF-8 and must not be
  re-encoded or normalised (Unicode normalisation changes the text).

## 12. Endpoint map

```
system   /health · /version · /openapi.yaml · /stats · /sources · /editions · /datasets
quran    /surahs · /surahs/{id} · /surahs/{id}/ayahs · /ayahs/{id} · /ayahs/by-key/{s}:{a}
struct   /juzs · /juzs/{n}[/ayahs] · /hizbs · /hizbs/{n}[/ayahs] · /rubs/{n}/ayahs
         /pages/{p}[/ayahs] · /manzils · /manzils/{n}/ayahs · /sajdahs
search   /search
text     /translations · /qiraat · /riwayat
audio    /reciters[?search=] · /reciters/{id}[/riwayat|/recitations|/surahs|
         /surahs/{surah}|/juzs/{juz}|/full-quran] · /ayahs/{id}/audio ·
         /surahs/{id}/audio · /audio/search
offline  /downloads/quran · /downloads/reciters/{id}/surah/{surah}
user     /me/bookmarks · /me/favorites · /me/favorite-reciters · /me/progress ·
         /me/audio-progress · /me/settings
```

Full schemas: `openapi/openapi.yaml`, also served live at
`GET /api/v1/openapi.yaml`.

## 13. Examples

Runnable clients in seven languages live in [`examples/`](examples/):
`curl.sh`, `javascript.mjs`, `typescript.ts`, `dart.dart`, `flutter.dart`,
`python.py`, `php.php`. Each one reads the base URL from the environment, so
none of them contains a hardcoded host.
