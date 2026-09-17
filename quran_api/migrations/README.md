# migrations — the Quran platform schema

These files own the `quran` schema and are all the API needs. They are
self-contained: applying them to an empty PostgreSQL 16 database (or to a
Supabase project) is enough to run the service — nothing from the rest of this
repository is required.

| File | What it creates |
|---|---|
| `001_quran_platform.sql` | schema `quran`: sources, editions, dataset versions, qira'at, riwayat, surahs, ayahs (+ SOURCE_LOCK trigger), juz/hizb/page/manzil, translations, reciters/recitations/audio, tafsir/word-by-word/topics architecture, user tables, audit log, RLS on everything |
| `002_human_verification.sql` | `human_verifications` + the trigger that refuses to publish a dataset no person approved |
| `003_license_center.sql` | `license_records` + the trigger that refuses `CONFIRMED` without evidence, and the `license_gate` view |

Apply them in order:

```bash
DATABASE_URL=… npm run db:apply
```

On plain PostgreSQL the first file also creates the Supabase-compatible roles
(`anon`, `authenticated`, `service_role`) and an `auth.uid()` stand-in, so the
same SQL works locally and on Supabase.

The FALAH app's own schema (tables in `public`) lives in `supabase/migrations/`
and is unrelated to this service.
