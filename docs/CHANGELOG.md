# Changelog

## 1.4.0 — 2026-08-28

Master Directive v2 alignment (docs + incremental code, no rebuilds).

### Added
- Governance docs: `docs/adr/` (six binding ADRs), `MIGRATION.md` (staged Flutter
  path — not executed), `ROADMAP.md`, `PROJECT_STATUS.md`, `SKILL_REGISTRY.md`,
  `docs/AI_RULES.md`, `docs/SOURCE_POLICY.md`; ARCHITECTURE gained a v2 alignment map.
- AI guard: canonical Appendix (هـ) refusal texts, fatwa-request detection and
  sacred-text-alteration detection, with new red tests.
- Scheduler: exponential-backoff retry (max 3 attempts) for transient publish
  failures + per-post idempotency key honored by the publisher contract;
  permanent errors (unconfigured platform, Source Lock, validation) still fail
  fast and honestly.
- `.env.example` server-secret names aligned with v2 Appendix (ب).

### Tests
58 passing (adds fatwa/alteration refusals and retry lifecycle).


## 1.3.0 — 2026-08-28

Feature-complete release (closes the remaining master-directive items).

### Added
- **In-app notification center (Phase 12)**: bell with live unread badge in the
  header, notification panel (mark read / clear), persisted per user in
  IndexedDB; wired to publish success/failure, scheduling, and every export.
- **Library export & share**: export PNG or share via the native share sheet
  (Web Share API with files, graceful download fallback) directly from any
  library card — always through the Source Lock approval gate.
- **Video recitation voice**: the reciter chosen in the create flow now backs
  the video audio, and can be switched from a reciter picker inside the video
  modal.
- **Home templates strip**: the eight design templates are browsable from the
  home screen; tapping one opens the Quran create flow with that template
  pre-applied to the generated design.

### Tests
55 passing (adds the notification-center suite).

## 1.2.0 — 2026-08-28

Visual identity release.

### Added
- Subtle Islamic geometric pattern (rub-el-hizb tile) woven into the hero,
  verse-of-day card, create-hub cards, and drawer identity card.
- Home hero: gradient emerald banner; quick actions with per-category tinted
  icon chips (green/gold/blue/violet); verse card with golden corner ornaments.
- Create hub: rich gradient cards (emerald Quran / golden-brown Hadith) with
  gold icons.
- Navigation: active pill indicator behind the current tab icon; glowing
  gradient create button with hover lift; blurred translucent header.
- Buttons: gradient primary with glow hover and press feedback; styled thin
  scrollbars; circular tinted empty-state icons; dotted canvas backdrop and
  card-style toolbar in the editor; gradient user bubbles in the assistant.

## 1.1.0 — 2026-08-28

Professional polish release.

### Added
- **Design templates**: 8 curated looks (free + premium) with decorative frames,
  applied in one tap from the editor's new Templates tab — styling only, sacred
  text and checksums untouched (tested).
- **Global audio player bar**: play/pause, seek with timestamps, speed
  (0.75×–2×), loop, volume — persistent above the navigation.
- **Editor pro tools**: responsive stage that fits any screen, snap-to-center
  guides while dragging, keyboard shortcuts (Delete, Ctrl+Z / Ctrl+Shift+Z /
  Ctrl+Y, arrow-key nudging with Shift), numeric X/Y/W/H controls, rotation
  slider, line-height control, one-tap watermark.
- **SVG icon system**: ~40 consistent stroke icons replacing emoji across the
  entire UI (navigation, drawer, editor, library, audio).
- **True offline PWA**: service worker with app-shell precache, immutable asset
  caching, and a capped runtime cache for fonts and recitation audio.
- **Route-level code splitting** (React.lazy) — initial bundle cut by ~20% —
  plus a top-level React error boundary with a friendly recovery screen.
- **CI (GitHub Actions)**: typecheck, lint, format check, tests, build artifact,
  and schema validation against a real PostgreSQL 16 service with RLS checks.
- SEO/social meta tags and robots.txt.

### Tests
52 passing (adds template styling-guarantee suite).

## 1.0.0 — 2026-08-28

Initial production-ready release.

### Added
- Clean architecture foundation (core/features, Zustand, strict TS, Vite PWA).
- Design system: tokens, light/dark/system themes, RTL-first responsive shell
  (bottom nav on phones, side rail ≥900px), drawer menu.
- i18n: Arabic + English with dynamic RTL/LTR and a runtime locale registry.
- Quran engine: full Tanzil Uthmani text + Sahih International translation bundled
  offline (per-surah code splitting + IndexedDB cache), reference & normalized Arabic
  search, 4 reciters with per-ayah audio, live juz/page/tafsir enrichment.
- Hadith engine: verified Nawawi's 40 seed with full source metadata; sunnah.com
  integration (keyed); grades never asserted without attribution.
- SOURCE LOCK: checksummed LockedText, immutable sacred elements, user-approval export
  gate, verification pipeline blocking tampered/blocked content; AI guard that routes
  sacred-text requests to verified sources or refuses.
- Content editor: canvas stage with drag/resize, layers, text/shape/image, gradients,
  Arabic fonts, undo/redo, PNG export, thumbnails.
- Video creator: real WebM rendering (canvas+MediaRecorder) with fade/rise/typewriter
  animations, subtitles, recitation audio mixing, all four aspect ratios.
- Library: filters, search, sort, duplicate, favorite, delete; offline-first.
- Scheduler: date/time/platform/repeat with full status lifecycle and honest failures.
- SocialPublisher abstraction with six platform adapters (OAuth-ready, no fake publishing).
- AI assistant: local rule-based provider + Anthropic-backed edge function (claude-opus-5).
- Auth: Supabase email/password + honest local mode; entitlements per plan (backend data).
- PostgreSQL schema (21 tables) with RLS everywhere, append-only audit log, validated
  against a real PostgreSQL in CI.
- Test suite (48 tests), lint/typecheck/format gates, full documentation set.
