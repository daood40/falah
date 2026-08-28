# FALAH — Testing

## Automated suite (Vitest + Testing Library + fake-indexeddb)

`npm test` — 55 tests across 10 files:

| File | Covers |
|---|---|
| `core/sourcelock/sourceLock.test.ts` | checksums, tampering detection, publish gate, approval requirement, blocked sources, status precedence |
| `features/quran/quran.test.ts` | 114 surahs, verified Fatiha, reference parsing (incl. ٢:٢٥٥), Arabic-normalized search, surah-name search, audio global-ayah mapping (6236) |
| `features/hadith/hadith.test.ts` | verified seed, hadith #1 integrity, **no unattributed grades**, Arabic/English/number search |
| `features/editor/editor.test.ts` | element CRUD, undo/redo, **sacred text immutability**, project factory, tamper-blocking on publish |
| `features/scheduler/scheduler.test.ts` | past-time rejection, lifecycle, cancel→draft, honest `failed` when platforms unconfigured |
| `features/ai/assistant.test.ts` | sacred-prompt detection, verified routing, **refusal without source**, local answers, citation validation |
| `core/core.test.ts` | i18n ar/en + runtime locale registration, entitlements, error mapping, text wrapping |
| `app/app.test.tsx` | RTL/LTR document switching, dark mode attribute, create hub rendering, library empty state |
| `features/templates/templates.test.ts` | template catalog, styling-only guarantee (sacred text + checksum untouched, publish gate still passes), decoration replacement |
| `core/notifications/notifications.test.ts` | persistence per user, live unread badge, mark-all-read, clear |

Also validated:

- `npm run typecheck` — TS strict (noUncheckedIndexedAccess).
- `npm run lint` — typescript-eslint, zero warnings.
- `npm run db:validate` — the full schema applies to a real PostgreSQL 16 with RLS on 21 tables.
- `npm run build` — production build with per-surah code splitting.

## Manual QA checklist

- [ ] Every bottom-nav destination renders (home, assistant, create, library, settings)
- [ ] Drawer: theme light/dark/system, language ar/en flips dir instantly, logout
- [ ] Quran: search "الرحمن", "2:255", surah picker, listen button plays/pauses
- [ ] Hadith: search "النية", open in editor
- [ ] Editor: drag (snap guides appear at center), resize, layers reorder, sacred text
      uneditable (lock badge), undo/redo (also Ctrl+Z), arrow-key nudge, templates tab, save
- [ ] Export PNG requires the approval checkbox when sacred text present
- [ ] Video: render 5s reel, preview plays, WebM downloads (Chrome/Edge; Safari fallback msg)
- [ ] Scheduler: past time rejected; scheduled post appears on home + library
- [ ] Audio bar: seek, speed 1.5×, loop, volume, close
- [ ] Offline (production build): airplane mode → app loads via service worker, library/editor
      work, banner shows
- [ ] Empty states: fresh library, no search results
- [ ] Error states: audio without network shows friendly toast
- [ ] Tablet ≥900px: side rail replaces bottom nav; editor two-column
- [ ] Font scaling 200% and keyboard navigation through drawer/editor tabs
