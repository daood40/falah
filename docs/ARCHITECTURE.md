# FALAH — Architecture

> **Governing reference:** Master Directive **v2** (2026-08-28). Binding decisions live
> in [`adr/`](adr/README.md); the Flutter target (ADR-001) is a staged migration
> documented in [`MIGRATION.md`](../MIGRATION.md) — this document describes the
> **current, live React PWA**, which remains the product until that migration ships.

## Layers (Clean Architecture)

```
src/
├── app/                  # composition root: App, router, AppShell layout
├── core/                 # cross-cutting: no feature imports core→feature except types
│   ├── config/           # typed env access (no secrets in client)
│   ├── design/           # design tokens (CSS variables) + base components CSS
│   ├── db/               # Dexie (IndexedDB) offline store
│   ├── entitlements/     # plan limits as data (backend-overridable)
│   ├── errors/           # AppError kinds → translated user messages; technical logs
│   ├── i18n/             # ar/en dictionaries, runtime locale registry (50+ ready)
│   ├── models/           # shared content models (projects, elements, formats)
│   ├── sourcelock/       # SOURCE LOCK: LockedText, checksums, publish gate
│   ├── supabase/         # lazy client, local-mode guard
│   ├── audit/            # audit log for sensitive operations
│   └── ui/               # shared primitives (Modal, Toast, states)
└── features/<name>/
    ├── domain/           # pure logic + types (unit-tested)
    ├── data/             # repositories, API clients, renderers
    └── presentation/     # React pages/components + feature CSS
```

State management: **Zustand** stores per concern (`useEditor`, `useAuth`, `useI18n`,
`useTheme`, `useAudio`, `useToasts`) — predictable, testable without providers.

## SOURCE LOCK pipeline

```
SOURCE (registry entry with id/name/url/version/review_status)
  → FETCH      (bundled dataset or live API)
  → NORMALIZE  (whitespace only — letters are never altered)
  → VERIFY     (SHA-256 checksum recorded in LockedText)
  → DISPLAY    (sacred-text elements are immutable in the editor store)
  → USER APPROVAL (explicit checkbox in the export gate)
  → EXPORT/PUBLISH (assertProjectPublishable re-verifies every checksum;
                    any mismatch or blocked source → AppError('source_lock') → BLOCK)
```

Enforced at four independent points:

1. `editorStore.guardSacred` silently drops `text` patches on sacred elements.
2. `assertPublishable` (export, video render, scheduler publish) re-hashes the text.
3. The AI `sourceLockRouter` intercepts sacred-text prompts client-side and only ever
   returns verified references (or refuses).
4. The `ai-assistant` edge function's system prompt forbids authoring religious text
   (defense in depth) — and the client guard runs *before* the network call anyway.

## Data flow (offline-first)

- All user content lives in IndexedDB (Dexie) and works with no network.
- Quran: 114 per-surah JSON chunks are code-split by Vite and cached into IndexedDB on
  first use (lazy loading). Search warms the cache progressively.
- The live API layer (alquran.cloud) only *enriches* (juz/page/tafsir); the app never
  depends on it.
- When Supabase is configured, repositories can sync `content_projects`/`scheduled_posts`
  upward; the local DB remains the source of truth for editing (last-write-wins by
  `updated_at`).

## Rendering engine

`features/editor/domain/renderEngine.ts` is the single canvas painter used by:

- PNG export (full resolution per platform format), and
- the video renderer (`features/video/data/videoRenderer.ts`), which drives it per-frame
  with animation progress + subtitles, records via `canvas.captureStream()` +
  `MediaRecorder` (WebM VP9/VP8), and mixes recitation audio through WebAudio.

**MP4 path (optional, server-side):** deploy an FFmpeg worker (or ffmpeg.wasm client-side)
that transcodes the WebM output; the renderer is codec-agnostic. WebM uploads are accepted
by the target platforms' APIs.

## SocialPublisher

`features/publishing/domain/socialPublisher.ts` defines `PlatformPublisher`; each platform
is an adapter registered in a map — adding a platform touches nothing else. OAuth flows and
uploads run through edge functions so app secrets stay server-side. Unconfigured adapters
throw `AppError('not_configured')` — publishing never silently pretends.

## Scheduler

Client tick (60s, while the app is open) + server cron (see DEPLOYMENT) both call
`processDuePosts`, which re-exports media through the Source Lock gate at publish time.
Statuses: `draft → scheduled → publishing → published | failed` (+ repeat daily/weekly).

## Performance

- Route-level and per-surah code splitting; the Quran never loads eagerly.
- Debounced search (300ms); Dexie indexes on every hot query path.
- Thumbnails are small JPEGs; canvas exports run at capped resolutions (entitlements).
- CSS variables theming — zero runtime style recalculation on theme switch.

## v2 alignment map

How the running code maps to Directive v2's technical rules, and where the gaps are
(tracked in `ROADMAP.md`):

- **§4 SOURCE_LOCK enforcement** — locked read-only sacred blocks, content hashing and
  the publish gate are live (see pipeline above). *Gap:* export files don't yet embed
  `source_id`/`content_hash` metadata inside the PNG/WebM containers.
- **§9 verification pipeline** — implemented as SOURCE→FETCH→NORMALIZE→VERIFY→DISPLAY→
  APPROVAL→EXPORT; normalization-before-hash policy is documented in
  [`SOURCE_POLICY.md`](SOURCE_POLICY.md). *Gap:* `verification_records` persistence and
  the human-review workflow (§10) arrive with the v2 schema migration.
- **§17 AI architecture** — client guard + server system prompt are live (ADR-005
  layers 1–2); canonical refusal texts follow Appendix (هـ). *Gap:* server-side tool
  calling + Output Guard + `ai_requests/ai_logs` (layer 3).
- **§20 scheduling** — full status lifecycle plus exponential-backoff retry (≤3
  attempts) and an idempotency key per post, honored by the publisher contract.
- **§21 connectors** — the modular `PlatformPublisher` interface matches Appendix (د);
  real OAuth connectors and KMS token encryption (ADR-006) are Phase 4.
- **§29 database** — 21 tables with RLS today; the additional v2 tables land as an
  additive migration (`0002_v2.sql`), never a rebuild.

## Extensibility contracts

- **Locales**: `registerLocale(info, dictionary)` — no code changes for new languages.
- **Riwayat/reciters/translations/tafsirs**: data registries in `quran/domain/types.ts`
  and DB tables keyed by edition — additive only.
- **Platforms**: implement `PlatformPublisher`, call `registerPublisher`.
- **Entitlements**: values come from `subscription_plans.entitlements` JSON at runtime.
