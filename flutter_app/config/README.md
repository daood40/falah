# Build configurations

The app never hardcodes an API URL. Each build passes one of these files:

```bash
flutter run   --dart-define-from-file=config/development.json
flutter build apk --release --dart-define-from-file=config/production.json
flutter build appbundle --release --dart-define-from-file=config/production.json
```

| Key | Meaning |
|---|---|
| `QURAN_API_BASE_URL` | Base URL of the FALAH Quran API, **without** `/api/v1` (the client appends it). Must be `https://` in staging and production. |
| `QURAN_API_EDITION` | Edition slug used for text and structure requests. |
| `FALAH_ENV` | `development` / `staging` / `production` — used for diagnostics only. |

`staging.json` and `production.json` ship with an **empty** `QURAN_API_BASE_URL`
on purpose: no API has been deployed yet, and inventing a URL would be a lie. An
empty value makes the app fall back to its bundled offline dataset and skip every
network call (`quranApiEnabledProvider` is false).

Fill the value once the owner provides the deployed base URL, e.g.
`https://api.falah.app`. Nothing else in the code changes.

`development.json` points at `10.0.2.2:8787`, which is how the Android emulator
reaches a server running on the host machine. It is plain HTTP by design and is
only ever used by debug builds.
