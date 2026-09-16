# Client examples

Every example reads the base URL from `FALAH_API_BASE_URL` — no host is
hardcoded, so the same file works against a local server, staging or production.

```bash
export FALAH_API_BASE_URL=https://api.example.com   # no trailing /api/v1
```

| File | Runtime | Run |
|---|---|---|
| `curl.sh` | bash + curl | `./curl.sh` |
| `javascript.mjs` | Node 18+ / browser | `node javascript.mjs` |
| `typescript.ts` | Node 22+ | `node typescript.ts` |
| `dart.dart` | Dart 3 (no Flutter) | `dart run dart.dart` |
| `flutter.dart` | Flutter | reference screen using the in-app client |
| `python.py` | Python 3.10+ (stdlib) | `python3 python.py` |
| `php.php` | PHP 8.1+ (curl ext) | `php php.php` |

All of them call the same read-only endpoints: `/health`, `/version`, `/stats`,
`/sources`, `/surahs`, `/surahs/{id}`, `/surahs/{id}/ayahs`, `/ayahs/by-key/…`,
`/search`, `/juzs`, `/pages/{page}`.

Authenticated calls (`/me/*`) take a Supabase access token; pass it to the
client constructor or as the `Authorization: Bearer …` header.
