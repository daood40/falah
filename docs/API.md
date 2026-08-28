# FALAH — APIs & Integrations

## Consumed APIs

| API | Purpose | Auth | Failure behavior |
|---|---|---|---|
| Bundled `quran-json` dataset | Complete Quran (Tanzil Uthmani + Sahih Intl.) | none (offline) | — (always available) |
| `api.alquran.cloud` | Enrichment: juz/page/hizb + التفسير الميسر | none | silent fallback to bundled data |
| `cdn.islamic.network` | Per-ayah recitation MP3 (4 reciters) | none | audio error toast; app unaffected |
| `api.sunnah.com` | Live hadith collections (Bukhari, Muslim, …) | `x-api-key` (`VITE_SUNNAH_API_KEY`) | module reports unavailable; bundled Nawawi 40 used |
| Anthropic API | AI assistant | server-side key in edge function | falls back to the local rule-based assistant |

## Edge Functions (`supabase/functions/`)

### `ai-assistant` (implemented)

`POST` `{ messages: [{role, text}] (≤6), userText: string (≤4KB) }` → `{ reply: string }`

- Model: `claude-opus-5`, `max_tokens: 1024`, cached system prompt.
- System prompt enforces Source Lock (never authors religious text) — defense in depth
  behind the client-side guard.
- `503` when `ANTHROPIC_API_KEY` is unset; the client then uses the local assistant.

### Publishing functions (specified, require operator credentials)

Each platform adapter targets one function route. They are intentionally **not stubbed
with fake success** — until deployed with credentials, adapters throw `not_configured`.

| Route | Platforms | Credentials needed (operator) |
|---|---|---|
| `publish-meta` | Instagram, Facebook | Meta app (`META_APP_ID/SECRET`), Instagram Graph API, `pages_manage_posts` |
| `publish-tiktok` | TikTok | TikTok for Developers app (`TIKTOK_CLIENT_KEY/SECRET`), Content Posting API |
| `publish-youtube` | YouTube | Google Cloud OAuth client (`YOUTUBE_CLIENT_ID/SECRET`), YouTube Data API v3 |
| `publish-telegram` | Telegram | `TELEGRAM_BOT_TOKEN` (bot must admin the channel) |
| `publish-x` | X | X developer app (`X_API_KEY/SECRET`), media upload + tweet endpoints |

Contract for every publish function:
`POST { platform, media (storage path), caption, account_id }` →
`{ remoteId, url }` or a typed error. The scheduler stores results in
`scheduled_posts.remote_post_id` / `last_error`.

## Client repositories (internal API surface)

- `quranRepository`: `listSurahs, getSurahAyahs, getAyah(Range), searchQuran, ayahAudioUrl`
- `hadithRepository`: `listCollections, listHadiths, searchHadiths, getHadith`
- `libraryRepository`: CRUD + `duplicateProject, toggleFavorite, setProjectStatus`
- `scheduler`: `schedulePost, listScheduled, cancelScheduled, updateScheduled, processDuePosts`
- `socialPublisher`: `publisherFor(platform).publish(payload)` (source-locked media only)
