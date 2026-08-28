# Changelog

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
