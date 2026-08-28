# FALAH — Deployment

## 1. Frontend (static PWA)

```bash
npm ci
npm run build          # outputs dist/
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, S3+CDN).
SPA routing: rewrite all paths to `/index.html`
(Netlify: `/* /index.html 200`; Vercel: `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`).

The app is fully functional with **no backend** (local mode).

## 2. Supabase backend (optional but recommended)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <ref>
supabase db push                       # applies supabase/migrations/0001_init.sql
```

Set the client env in your host's build settings:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### AI assistant

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-assistant
```

### Scheduled publishing cron (server-side)

The client processes due posts while open; for reliable unattended publishing, add a
Supabase Scheduled Function (or pg_cron) hitting a `process-due-posts` function every
minute that scans `scheduled_posts (status='scheduled', scheduled_at <= now())` — the
index `scheduled_posts_due_idx` exists for exactly this scan.

## 3. Social platform credentials (operator setup)

Each platform requires an app you must register (FALAH cannot invent these):

| Platform | Where | What to configure |
|---|---|---|
| Instagram/Facebook | developers.facebook.com | App + Instagram Graph API, OAuth redirect `https://<host>/auth/callback/meta`, secrets `META_APP_ID`, `META_APP_SECRET` |
| TikTok | developers.tiktok.com | Content Posting API, `TIKTOK_CLIENT_KEY/SECRET` |
| YouTube | console.cloud.google.com | YouTube Data API v3 OAuth client, `YOUTUBE_CLIENT_ID/SECRET` |
| Telegram | @BotFather | `TELEGRAM_BOT_TOKEN`; add the bot as channel admin |
| X | developer.x.com | App with media upload scope, `X_API_KEY/SECRET` |

Store all of them with `supabase secrets set ...` and deploy the corresponding
`publish-*` functions (contracts in [API.md](API.md)). Until then, FALAH truthfully shows
"غير مُهيأ" and scheduled posts to those platforms fail with a clear error — by design.

## 4. Hadith live API (optional)

Request a key at https://sunnah.api-docs.io and set `VITE_SUNNAH_API_KEY` at build time.

## 5. Database validation in CI

```bash
npm run db:validate    # spins up / uses PostgreSQL 16 and applies the migration
```

## 6. Native shells (later)

The PWA installs to home screen on Android/iOS today. For store distribution, wrap with
Capacitor (`npx cap add android ios`) — no code changes required; the responsive layout
already targets phone/tablet.
