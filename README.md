# فلاح — FALAH

منصة احترافية لصناعة وتنظيم ونشر المحتوى الإسلامي الموثوق.
A professional platform for creating, organizing, and publishing trusted Islamic content.

> **القاعدة الذهبية — SOURCE LOCK**: لا يُعرض أو يُصدَّر أي نص ديني (قرآن، حديث، تفسير، أذكار)
> إلا من مصدر موثّق مع بيانات وصفية كاملة وبصمة تحقق (checksum). الذكاء الاصطناعي في فلاح
> **لا يؤلف نصوصًا دينية أبدًا** — يساعد فقط في التصميم والأفكار والتنظيم.

## Features

- 📖 **Quran Engine** — the complete Quran (Tanzil Uthmani text, Hafs riwayah) bundled offline
  with Sahih International translation, reference search (`2:255`), diacritics-insensitive
  Arabic search, per-ayah recitation audio (4 reciters), and live tafsir/juz/page enrichment.
- 📜 **Hadith Engine** — verified Nawawi's 40 collection bundled offline (Arabic + English +
  narrator + full source metadata); sunnah.com API integration for the six books (keyed).
- 🎨 **Content Editor** — canvas editor with layers, drag & drop, resize, snap-to-center
  guides, keyboard shortcuts, numeric position/rotation controls, watermark, text/shape/image
  elements, gradients, Arabic typography, undo/redo. Sacred text is **immutable** in the editor.
- 🧩 **Design Templates** — 8 curated looks (free + premium) applied in one tap; templates
  restyle only (background/colors/frames) and can never alter sacred text.
- 🎬 **Video Creator** — real in-browser video rendering (canvas + MediaRecorder → WebM) with
  text animations, subtitles, recitation audio mixing, and 9:16 / 1:1 / 16:9 / 4:5 formats.
- 🗂️ **Library** — offline-first (IndexedDB) with filters, search, sort, duplicate, favorite.
- 🗓️ **Scheduler** — schedule to platforms with repeat rules and the full
  draft → scheduled → publishing → published/failed lifecycle.
- 🔌 **SocialPublisher** — pluggable adapters for Instagram/Facebook/TikTok/YouTube/Telegram/X.
  Honest by design: without operator OAuth credentials, publishing reports *not configured*
  instead of pretending to work.
- ✨ **AI Assistant** — design ideas, titles, hashtags, layout help. Requests for religious text
  are routed to the verified engines or **refused** (source-lock guard, client + server side).
- 🌍 **i18n** — Arabic (RTL) + English (LTR), dynamic direction, architecture scales to 50+ locales.
- 🔊 **Audio Player** — global player bar with seek, speed (0.75×–2×), loop, and volume.
- 🌗 Light / Dark / System themes · 📱 Responsive phone/tablet/desktop · ♿ a11y-conscious ·
  installable **offline PWA** (service worker) · route-level code splitting · CI on every push.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript (strict) + Vite, PWA |
| State | Zustand |
| Offline store | IndexedDB (Dexie) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) — optional; app runs fully in local mode without it |
| AI | Anthropic API via the `ai-assistant` Edge Function (server-side key) |
| Quran data | [quran-json](https://github.com/risan/quran-json) (Tanzil Uthmani + Sahih Intl.) |
| Hadith data | Nawawi's 40 dataset + sunnah.com API |

> **Why a web PWA?** It runs excellently on Android, iOS, tablet, and web from one codebase,
> and every part of it (tests, build, DB schema) is verifiable in CI. The clean architecture
> (core / features / data / domain / presentation) ports directly to Flutter if a native
> shell is wanted later.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Works immediately in **local mode** (no accounts, everything on-device).

### Full backend (optional)

```bash
cp .env.example .env         # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
supabase db push             # applies supabase/migrations
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-assistant
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck + production build |
| `npm test` | unit + component tests (Vitest) |
| `npm run lint` / `npm run typecheck` / `npm run format` | quality gates |
| `npm run db:validate` | applies the SQL schema to a real PostgreSQL and sanity-checks it |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, source lock pipeline, offline-first sync
- [docs/DATABASE.md](docs/DATABASE.md) — schema, RLS, indexes
- [docs/SECURITY.md](docs/SECURITY.md) — threat model, secrets, RLS, audit
- [docs/API.md](docs/API.md) — external APIs and edge functions
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — hosting, Supabase, social platform credentials
- [docs/TESTING.md](docs/TESTING.md) — test strategy and QA checklist
- [docs/CHANGELOG.md](docs/CHANGELOG.md) · [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

## Content licenses

Quran text: Tanzil Project (CC BY-ND terms) via quran-json (CC BY 4.0).
Recitation audio: [cdn.islamic.network](https://alquran.cloud). Attribute sources when publishing.
