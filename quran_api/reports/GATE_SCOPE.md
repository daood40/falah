# Quality gate — scope

What the gate tests, and what is deliberately outside it. Nothing here is a
"blocked test": a gate case is either executed (PASS/FAIL) or it is not a case
at all. Items below are owner decisions or missing infrastructure, recorded so
the numbers cannot be read as covering them.

## Where each category runs

| Category | Runner | Why |
|---|---|---|
| quran-data, import-integrity, api, search, security, database-rls, openapi, cache-offline, performance, reliability, backup-restore, license-verification, regression | `gate-core` (ubuntu + PostgreSQL 16 service) | needs a real database and a real HTTP server |
| web | `gate-web` (ubuntu + PWA dependencies) | runs the PWA's own vitest suite |
| docker-deploy | `gate-docker` (ubuntu + Docker daemon) | builds and runs the real image |
| flutter | `gate-flutter` (ubuntu + Flutter SDK) | analyze, the Dart suite, the web build |
| mobile | `gate-android` (ubuntu + Flutter + Android SDK + emulator, API 29 and 34) | release APK and the on-device run |

The merge job (`gate-merge`) combines every evidence file and fails the run on
any FAIL, BLOCKED, SKIPPED, duplicate id, or category below its minimum.

## Out of scope — owner decisions

1. **iOS** — owner decision, 2026-09-17: no macOS runner is enabled for this
   repository (macOS minutes on a private repository bill at 10x). There is no
   `flutter_app/ios` project yet. To bring iOS into the gate: generate the iOS
   project, enable a `macos-latest` job and add the simulator matrix; the device
   test (`integration_test/gate_device_test.dart`) runs unchanged on iOS.
2. **Hadith API** — owner decision, 2026-09-17: not built. The repository has a
   PWA client for sunnah.com only; that content needs an API key and carries no
   redistribution licence. No hadith text is stored, served or tested, and the
   release report claims no hadith coverage.

## Out of scope — infrastructure that does not exist

3. **Deployment** (registry push, TLS termination, public URL, rollback) — there
   is no host, no registry and no credentials, and PRIVATE_MODE stays on. The
   container is tested in full on the runner instead: build, image contents,
   fail-closed configuration, serving the whole dataset, restart and shutdown.
4. **Image vulnerability scanning** — a supply-chain control over the upstream
   base image rather than a test of this code. Run it in the release pipeline
   once a registry exists.

## Category minimums

`quran_api/tests/gate/report.ts` holds the required minimum per category. Two
were revised on 2026-09-17 when the scope above was settled:

- `mobile`: 300 — now Android-only (was Android + iOS).
- `docker-deploy`: 250 — the executable container matrix (was 300, which
  included the deployment steps now listed as owner items).

Every other minimum is unchanged from the original 65-area matrix.
