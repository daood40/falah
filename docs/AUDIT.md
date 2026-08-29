# FALAH — Full Professional Audit (v1.4.0 → v1.5.0)

**Date:** 2026-08-28 · **Method:** live Chromium walkthrough of the production build
(8 screens, mobile viewport, console captured) + code-surface inspection + bundle
analysis. Baseline: 58/58 tests, typecheck/lint/format clean.

## 1. Product audit

**Users:** individual muslims creating shareable verse/hadith designs; da'wah content
creators producing batches; institutions (review workflow — future); shariah reviewers
(future). **Core value:** trustworthy religious content (SOURCE_LOCK) turned into
polished designs, fast. **Primary flows:** find verse/hadith → design → export/share
→ (schedule → publish). **Secondary:** AI assist, library management, notifications.

**Product map (current):** Home (greeting/quick/verse/templates/recent/upcoming) ·
Create hub → Quran/Hadith creators → Editor (canvas, layers, templates, video) ·
Library (filters/search/export/share/schedule) · Assistant (guarded) · Settings ·
Auth (local-first). **Where users get lost:** managing scheduled posts (no dedicated
place; only visible on Home read-only), and no way to save their own design as a
reusable template (the 8 built-ins only).

## 2. Technical audit

Architecture is clean (core/features × domain/data/presentation, Zustand, strict TS,
repositories). No dead code found; no circular deps; naming consistent. **Debt found:**
`@supabase/supabase-js` bundles eagerly into the main chunk (590 KB raw / 179 KB gz)
though local mode never uses it; Modal lacks a focus trap; hardcoded `aria-label="close"`;
Quran font fallback stack too thin (no system Arabic fonts); no CSP.

## 3–4. UX / UI audit (screen by screen, live run)

- **Home**: good hierarchy; missing drafts/published/stats/account state; scheduled
  items are read-only. → Dashboard rebuild (Phase 1).
- **Library**: complete states, filters, bulk-able actions; sort/search fine.
- **Creators**: selection-only hadith (no free input) ✓; live preview ✓; touch
  targets: 8 sub-40px controls on Quran page.
- **Assistant / Settings**: 4–5 sub-40px targets each.
- **All pages**: exactly one h1 ✓, `lang`/`dir` correct ✓, no horizontal scroll ✓,
  every input labeled ✓, every icon button named ✓, images have alt ✓. No skip link ✗.
- **Empty/loading/error states**: present everywhere checked (skeletons + iconed
  empty states + error boundary).

## 5. Architecture audit → proposal

Keep the current layering (it is the proposed architecture); add: `publishing`
presentation page (scheduling hub), `templates` user-template repository (Dexie v3),
lazy Supabase module boundary. No rewrite justified.

## 6. Security audit

No `innerHTML`/`dangerouslySetInnerHTML`; no secrets in client (checked); tokens
never touch frontend (edge-function design); RLS everywhere in schema; honest
`not_configured` publishers. **To add:** CSP meta (script-src 'self'), Arabic font
fallbacks (availability), keep `.env` ignored (already).

## 7. Performance audit

Route + per-surah code splitting ✓, debounced search ✓, capped caches ✓.
**Main chunk 590 KB (179 gz)** — dominated by react-dom + supabase + dexie + zustand.
Fix: dynamic-import supabase (unused in local mode) and split vendor chunk.
Fonts: preconnect ✓; add robust fallback stacks.

## 8. Accessibility audit

Strong base (labels/names/alt/lang/headings/aria-live toasts/Escape). **Gaps:**
no focus trap in modals, no initial-focus management, no skip link, ~26 sub-40px
touch targets across 4 screens, untranslated close label.

## 9. Missing features (vs product bar)

User-saved templates (structure, not image) · dedicated publishing/scheduling hub ·
per-directive nav (6 destinations) · dashboard stats/drafts/account state.

## 10. Technical debt list

Eager supabase · modal focus · font fallbacks · CSP · touch targets · skip link.

## 11–12. Skills discovered / used

Available harness skills scanned. Used as method references for this pass:
`web-accessibility`, `responsive-design`, `web-performance`, `bundle-optimization`,
`progressive-web-apps`, `css-variables`, `semantic-html`, `xss-prevention`,
`typescript-strict-mode`, `code-review` (post-change review). Rejected: generic
k8s/terraform/docx-type skills (irrelevant to a client PWA).

## 13. Proposed architecture — unchanged core + three additions (see §5)

## 14. Design system

Already token-based (colors/spacing/radius/shadows/typography in `tokens.css`,
components in `base.css`; zero raw values policy). Additions this pass: touch-target
tokens, focus ring audit, font fallback stacks. Identity stays: calm premium
emerald/gold, geometric rub-el-hizb accents — no ornament inflation.

## 15–16. Roadmap & priorities (this transformation)

P1 Dashboard → P2 Navigation + Publishing hub + user templates → P3 Accessibility
→ P4 Performance → P5 Polish + dark/RTL regression → P6 Tests/docs/ship.
(Long-term product roadmap remains `ROADMAP.md`.)

## 17. Risks

Bundle refactor touching auth (mitigate: tests + local-mode default) · nav change
muscle-memory (labels unchanged where possible) · CSP breaking fonts/audio
(explicit allowlist, verified in live run).

## 18. Testing strategy

Keep 58 unit/integration; add: user-template save/apply guarantee (sacred text
untouched), publishing-page lifecycle; regression = full build + Playwright
walkthrough (light/dark, ar) with console-error budget of 0 app errors.

## 19. Definition of Done

Every phase: build ✓ run ✓ tests ✓ review ✓ regression walkthrough ✓ — plus v2
directive §36 (no TODO, RTL+dark checked, mobile/tablet/desktop, no dummy data,
documented in PROJECT_STATUS).

## Live-run evidence

Console errors: **0 from app code** (only sandbox-blocked fonts.googleapis.com +
alquran.cloud enrichment, both with graceful fallbacks by design). Screens captured:
home/create/quran/hadith/assistant/library/settings/auth + dark.
