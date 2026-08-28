# FALAH — Security

## Secrets

- **No secrets in the client.** The only client-side keys are the Supabase URL + anon key
  (safe by design; RLS protects data) and the optional sunnah.com key (read-only content API).
- `ANTHROPIC_API_KEY` and all social platform app secrets live exclusively in Supabase
  Edge Function secrets (`supabase secrets set`), never in `VITE_*` vars.
- `.env` is git-ignored; `.env.example` documents every variable.
- User OAuth tokens for social platforms are stored server-side in
  `social_accounts.encrypted_credentials` (pgsodium/Vault), written and read only by edge
  functions with the service role.

## Authentication & authorization

- Supabase Auth (email/password; extensible to OAuth providers).
- **Local mode is not fake auth** — it is an explicit device-only identity with no network
  claims, clearly labeled in the UI.
- Authorization = PostgreSQL RLS on every table (default-deny; owner policies). The
  service role is used only by server-side jobs (content ingestion, cron publisher).

## Input validation

- Client: typed models, range-clamped numeric inputs, min password length, future-date
  checks on scheduling, file inputs restricted to `image/*`.
- Edge function: validates method, payload shape, and caps `userText` at 4KB and history
  at 6 turns (also the AI cost control).
- SQL: constraints + parameterized access through supabase-js only (no string SQL).

## Rate limiting

- AI: per-plan daily message entitlements enforced in the client; the edge function should
  additionally be deployed behind Supabase's per-IP function rate limits (see DEPLOYMENT).
- Recommended: enable Supabase Auth's built-in rate limits for sign-in/sign-up.

## Content integrity (Source Lock as a security property)

Religious text tampering is treated as an integrity attack:
checksums at rest (DB) and in every `LockedText`, re-verified before display-independent
export/publish; append-only `audit_logs` record who exported/published what and when.

## Audit log

`sacred_text_locked, source_added/removed, content_created/updated/deleted/exported/
published, publish_failed, schedule_created/cancelled, account_settings_changed,
auth_login/logout, data_cleared` — with `user_id`, ISO timestamp, and metadata. Users can
insert and read only their own entries; nothing can update or delete them via the API.

## Error handling

Technical errors are logged (`console.error` locally; hook up a collector in production);
users only ever see translated, generic messages (`core/errors`). No stack traces or
internal identifiers reach the UI.

## Reporting

Please report vulnerabilities privately to the repository owner.
