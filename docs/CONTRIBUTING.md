# Contributing to FALAH

## Ground rules

1. **SOURCE LOCK is non-negotiable.** No PR may introduce a path where religious text is
   generated, edited, or displayed without verified source metadata. Any new content
   pipeline must go through `core/sourcelock` and add tests proving tampering is blocked.
2. Every feature keeps the `domain / data / presentation` split; domain logic must be
   unit-testable without React or the network.
3. No placeholders: no dead buttons, no fake API responses, no "coming soon" without an
   honest `not_configured` path.

## Workflow

```bash
npm install
npm run dev
# before pushing:
npm run typecheck && npm run lint && npm test && npm run build
npm run db:validate        # when touching supabase/migrations
```

- TypeScript strict; no `any` without justification (lint warns).
- UI strings go through i18n (`core/i18n/ar.ts` + `en.ts`) — never hardcode user-facing text.
- Styling uses design tokens (`core/design/tokens.css`); no magic colors/sizes in components.
- Keep components RTL-safe: use logical properties (`inset-inline-*`, `margin-inline-*`).
- New tables: enable RLS + policies in the same migration, and extend `scripts/validate-db.sh`
  sanity checks when useful.

## Adding a language

```ts
registerLocale({ code: 'tr', nativeName: 'Türkçe', dir: 'ltr' }, dictionary);
```
Provide a full dictionary (copy `en.ts` keys). Missing keys fall back to Arabic.

## Adding a social platform

Implement `PlatformPublisher`, register it in `socialPublisher.ts`, add the edge function
contract to `docs/API.md`, and document required credentials in `docs/DEPLOYMENT.md`.

## Commit style

Present-tense, scoped messages, e.g. `editor: add snap-to-center guides`.
