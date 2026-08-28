# Changelog

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
