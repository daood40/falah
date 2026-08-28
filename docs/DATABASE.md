# FALAH — Database

PostgreSQL (Supabase). Single migration: `supabase/migrations/0001_init.sql`.
Validated automatically against a real PostgreSQL 16 via `npm run db:validate`.

## Tables

| Group | Tables |
|---|---|
| Identity | `profiles` (1:1 with `auth.users`) |
| Sources | `content_sources` — the audit-able registry every religious text must reference |
| Quran | `quran_surahs`, `quran_ayahs` (checksum + source_id), `quran_translations`, `quran_tafsirs`, `reciters`, `recitations` |
| Hadith | `hadith_books`, `hadiths` (checksum + source_id), `hadith_translations`, `hadith_grades` (grade **always** carries `graded_by` + source) |
| Content | `content_projects` (elements/background as JSONB), `content_assets`, `templates` |
| Publishing | `social_accounts` (encrypted credentials), `scheduled_posts` |
| Billing | `subscription_plans` (entitlements as JSONB — prices/limits change without app release), `subscriptions` |
| Ops | `notifications`, `audit_logs` (insert-only for users) |

## Row Level Security

RLS is enabled on **all 21 public tables** (default-deny):

- Owner tables (`content_projects`, `scheduled_posts`, `social_accounts`, `content_assets`,
  `profiles`): `auth.uid() = user_id` for all operations.
- `subscriptions`, `notifications`: owner read (writes via service role/functions).
- `audit_logs`: owner **insert + select only** — no update/delete policies exist, making the
  audit trail append-only from the API.
- Reference data (Quran/Hadith/sources/templates/plans): public `select`; writes only via
  the service role (RLS bypass), i.e. controlled ingestion jobs.

## Integrity rules

- `quran_ayahs.checksum` / `hadiths.checksum` — SHA-256 of the canonical text, written at
  ingestion, re-verified by clients (Source Lock).
- `hadith_grades` is a separate table so an authenticity claim can never exist without
  attribution (`graded_by`) and a source.
- CHECK constraints on statuses, platforms, content types, review statuses.
- `updated_at` maintained by triggers.

## Indexes (hot paths)

- `content_projects (user_id, updated_at desc)` — library listing
- `content_projects (user_id, status)` — filters
- `scheduled_posts (status, scheduled_at)` — the cron "due" scan
- `quran_ayahs (surah)`, `hadiths (book_id)`, `notifications (user_id, read, created_at desc)`,
  `audit_logs (user_id, created_at desc)` + `(action, created_at desc)`

## Portability

The migration creates a stand-in `auth` schema + `auth.uid()` when run outside Supabase,
so the exact same file applies to any plain PostgreSQL — that is how CI validates it.
