-- ============================================================
-- FALAH — Quran Data Platform (schema: quran)
-- Apply with: supabase db push   (or psql -f on plain Postgres)
--
-- A dedicated schema keeps the platform isolated from the legacy
-- v1/v2 tables in `public` (public.reciters, public.quran_ayahs, ...).
-- SOURCE_LOCK: raw_text / text columns are never edited in place.
-- Every change to a dataset creates a NEW dataset version.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create schema if not exists quran;

-- auth.uid() stand-in for plain Postgres (Supabase already provides it).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid() returns uuid language sql stable as $fn$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')
      )::uuid
    $fn$;
  end if;
end $$;

-- Supabase-compatible roles (no-op when they already exist).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema quran to anon, authenticated, service_role;

-- ---------- Source registry ----------
create table quran.sources (
  id text primary key,
  name text not null,
  organization text,
  url text,
  api_url text,
  description text,
  language text,
  license text,
  license_url text,
  attribution_required boolean not null default true,
  attribution_text text,
  version text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'restricted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Editions / mushaf versions ----------
create table quran.quran_editions (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references quran.sources (id),
  slug text not null unique,
  name text not null,
  edition_type text not null check (edition_type in ('quran', 'translation', 'transliteration', 'tafsir')),
  riwayah text,
  qiraah text,
  script_type text,
  font_name text,
  version text,
  publisher text,
  country text,
  language text,
  license text,
  license_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Dataset versions (immutable history) ----------
create table quran.quran_dataset_versions (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references quran.sources (id),
  edition_id uuid references quran.quran_editions (id),
  version text not null,
  source_file_hash text not null,
  import_date timestamptz not null default now(),
  record_count integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'imported', 'verified', 'published', 'failed', 'superseded')),
  notes text,
  created_at timestamptz not null default now(),
  unique (source_id, edition_id, version)
);

-- ---------- Qiraat / riwayat ----------
create table quran.qiraat (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text,
  description text,
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quran.riwayat (
  id uuid primary key default gen_random_uuid(),
  qiraah_id uuid not null references quran.qiraat (id) on delete restrict,
  slug text not null unique,
  name_ar text not null,
  name_en text,
  description text,
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Surahs ----------
create table quran.surahs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references quran.quran_editions (id) on delete cascade,
  surah_number integer not null check (surah_number between 1 and 114),
  name_ar text not null,
  name_en text,
  name_transliteration text,
  revelation_place text check (revelation_place in ('makkah', 'madinah')),
  revelation_order integer,
  ayah_count integer not null check (ayah_count > 0),
  bismillah text,
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  dataset_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, surah_number)
);

-- ---------- Ayahs ----------
create table quran.ayahs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references quran.quran_editions (id) on delete cascade,
  surah_id uuid not null references quran.surahs (id) on delete cascade,
  ayah_number integer not null check (ayah_number > 0),
  global_ayah_number integer not null check (global_ayah_number > 0),
  juz_number integer,
  hizb_number integer,
  rub_number integer,
  page_number integer,
  manzil_number integer,
  ruku_number integer,
  sajdah boolean not null default false,
  sajdah_type text,
  raw_text text not null,
  text_uthmani text,
  text_simple text,
  search_text text,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(search_text, ''))) stored,
  -- Matching skeleton (search_text with alef dropped) so that the Uthmani
  -- superscript-alef spelling and the plain spelling match each other.
  search_skeleton text,
  search_skeleton_vector tsvector generated always as (to_tsvector('simple', coalesce(search_skeleton, ''))) stored,
  content_hash text not null,
  source_locked boolean not null default true,
  verified boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  dataset_version text,
  source_id text not null references quran.sources (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, surah_id, ayah_number),
  unique (edition_id, global_ayah_number)
);

create index ayahs_edition_global_idx on quran.ayahs (edition_id, global_ayah_number);
create index ayahs_juz_idx on quran.ayahs (edition_id, juz_number, global_ayah_number);
create index ayahs_hizb_idx on quran.ayahs (edition_id, hizb_number, global_ayah_number);
create index ayahs_rub_idx on quran.ayahs (edition_id, rub_number, global_ayah_number);
create index ayahs_page_idx on quran.ayahs (edition_id, page_number, global_ayah_number);
create index ayahs_manzil_idx on quran.ayahs (edition_id, manzil_number, global_ayah_number);
create index ayahs_sajdah_idx on quran.ayahs (edition_id, global_ayah_number) where sajdah;
create index ayahs_search_vector_idx on quran.ayahs using gin (search_vector);
create index ayahs_search_trgm_idx on quran.ayahs using gin (search_text gin_trgm_ops);
create index ayahs_skeleton_vector_idx on quran.ayahs using gin (search_skeleton_vector);
create index ayahs_skeleton_trgm_idx on quran.ayahs using gin (search_skeleton gin_trgm_ops);
create index ayahs_content_hash_idx on quran.ayahs (content_hash);

-- SOURCE_LOCK: raw_text is immutable once written.
create or replace function quran.enforce_source_lock() returns trigger
language plpgsql as $fn$
begin
  if old.source_locked and new.raw_text is distinct from old.raw_text then
    raise exception 'SOURCE_LOCK: raw_text is immutable (ayah %)', old.id
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $fn$;

create trigger ayahs_source_lock before update on quran.ayahs
  for each row execute function quran.enforce_source_lock();

-- ---------- Structural divisions (from source datasets only) ----------
create table quran.juzs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references quran.quran_editions (id) on delete cascade,
  juz_number integer not null check (juz_number between 1 and 30),
  start_surah integer not null,
  start_ayah integer not null,
  end_surah integer not null,
  end_ayah integer not null,
  start_global_ayah integer not null,
  end_global_ayah integer not null,
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (edition_id, juz_number)
);

create table quran.hizbs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references quran.quran_editions (id) on delete cascade,
  hizb_number integer not null check (hizb_number between 1 and 60),
  quarter integer not null check (quarter between 1 and 4),
  rub_number integer not null check (rub_number between 1 and 240),
  juz_number integer not null,
  start_surah integer not null,
  start_ayah integer not null,
  end_surah integer not null,
  end_ayah integer not null,
  start_global_ayah integer not null,
  end_global_ayah integer not null,
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (edition_id, rub_number)
);

create table quran.pages (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references quran.quran_editions (id) on delete cascade,
  page_number integer not null check (page_number > 0),
  start_surah integer not null,
  start_ayah integer not null,
  end_surah integer not null,
  end_ayah integer not null,
  start_global_ayah integer not null,
  end_global_ayah integer not null,
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (edition_id, page_number)
);

create table quran.manzils (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references quran.quran_editions (id) on delete cascade,
  manzil_number integer not null check (manzil_number between 1 and 7),
  start_surah integer not null,
  start_ayah integer not null,
  end_surah integer not null,
  end_ayah integer not null,
  start_global_ayah integer not null,
  end_global_ayah integer not null,
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (edition_id, manzil_number)
);

-- ---------- Translations ----------
create table quran.translations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  language text not null,
  translator text,
  title text not null,
  edition_id uuid references quran.quran_editions (id),
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  version text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quran.ayah_translations (
  id uuid primary key default gen_random_uuid(),
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  translation_id uuid not null references quran.translations (id) on delete cascade,
  text text not null,
  content_hash text not null,
  source_locked boolean not null default true,
  verified boolean not null default false,
  dataset_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ayah_id, translation_id)
);
create index ayah_translations_translation_idx on quran.ayah_translations (translation_id);

-- ---------- Reciters / recitations / audio ----------
create table quran.reciters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text,
  display_name text,
  bio text,
  country text,
  birth_year integer,
  death_year integer,
  photo_url text,
  website text,
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  attribution_required boolean not null default true,
  attribution_text text,
  verified boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reciters_name_trgm_idx on quran.reciters using gin (name_ar gin_trgm_ops);
create index reciters_name_en_trgm_idx on quran.reciters using gin (coalesce(name_en, '') gin_trgm_ops);

create table quran.reciter_riwayat (
  id uuid primary key default gen_random_uuid(),
  reciter_id uuid not null references quran.reciters (id) on delete cascade,
  riwayah_id uuid not null references quran.riwayat (id) on delete restrict,
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (reciter_id, riwayah_id)
);

create table quran.recitations (
  id uuid primary key default gen_random_uuid(),
  reciter_id uuid not null references quran.reciters (id) on delete cascade,
  riwayah_id uuid references quran.riwayat (id),
  edition_id uuid references quran.quran_editions (id),
  name text not null,
  type text not null check (type in ('murattal', 'mujawwad', 'muallim', 'translation')),
  quality text,
  format text,
  bitrate integer,
  sample_rate integer,
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  version text,
  status text not null default 'restricted'
    check (status in ('restricted', 'streaming_only', 'public')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recitations_reciter_idx on quran.recitations (reciter_id);

create table quran.audio_files (
  id uuid primary key default gen_random_uuid(),
  recitation_id uuid not null references quran.recitations (id) on delete cascade,
  surah_id uuid references quran.surahs (id) on delete cascade,
  ayah_id uuid references quran.ayahs (id) on delete cascade,
  juz_id uuid references quran.juzs (id) on delete cascade,
  sequence_number integer not null,
  audio_url text not null,
  stream_url text,
  download_url text,
  format text,
  codec text,
  bitrate integer,
  sample_rate integer,
  duration_ms integer,
  file_size bigint,
  checksum text,
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  status text not null default 'restricted'
    check (status in ('restricted', 'streaming_only', 'public')),
  verified boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  dataset_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (surah_id is not null or ayah_id is not null or juz_id is not null)
);
create index audio_files_recitation_seq_idx on quran.audio_files (recitation_id, sequence_number);
create index audio_files_ayah_idx on quran.audio_files (ayah_id);
create index audio_files_surah_idx on quran.audio_files (surah_id);

-- ---------- Tafsir / revelation contexts / words / topics (architecture only) ----------
create table quran.tafsir_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text,
  language text not null,
  edition text,
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  version text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quran.ayah_tafsirs (
  id uuid primary key default gen_random_uuid(),
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  tafsir_source_id uuid not null references quran.tafsir_sources (id) on delete cascade,
  text text not null,
  reference text,
  content_hash text not null,
  version text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ayah_id, tafsir_source_id)
);

create table quran.revelation_contexts (
  id uuid primary key default gen_random_uuid(),
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  text text not null,
  reference text,
  narrator text,
  grade text,
  source_id text not null references quran.sources (id),
  license text,
  license_url text,
  content_hash text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quran.ayah_words (
  id uuid primary key default gen_random_uuid(),
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  word_position integer not null check (word_position > 0),
  word_text text not null,
  translation text,
  root text,
  lemma text,
  morphology jsonb,
  source_id text not null references quran.sources (id),
  version text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (ayah_id, word_position)
);
create index ayah_words_root_idx on quran.ayah_words (root);

create table quran.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text,
  parent_id uuid references quran.topics (id),
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table quran.ayah_topics (
  id uuid primary key default gen_random_uuid(),
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  topic_id uuid not null references quran.topics (id) on delete cascade,
  source_id text not null references quran.sources (id),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (ayah_id, topic_id)
);

-- ---------- User data ----------
create table quran.user_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, ayah_id)
);
create index user_bookmarks_user_idx on quran.user_bookmarks (user_id);

create table quran.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, ayah_id)
);
create index user_favorites_user_idx on quran.user_favorites (user_id);

create table quran.user_reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  edition_id uuid not null references quran.quran_editions (id) on delete cascade,
  surah_id uuid not null references quran.surahs (id) on delete cascade,
  ayah_id uuid not null references quran.ayahs (id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (user_id, edition_id)
);

create table quran.user_favorite_reciters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reciter_id uuid not null references quran.reciters (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, reciter_id)
);

create table quran.user_audio_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recitation_id uuid not null references quran.recitations (id) on delete cascade,
  surah_id uuid references quran.surahs (id) on delete cascade,
  ayah_id uuid references quran.ayahs (id) on delete cascade,
  position_ms integer not null default 0 check (position_ms >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, recitation_id)
);

create table quran.user_quran_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  selected_edition uuid references quran.quran_editions (id),
  selected_riwayah uuid references quran.riwayat (id),
  selected_reciter uuid references quran.reciters (id),
  selected_translation uuid references quran.translations (id),
  selected_quality text,
  autoplay_next_ayah boolean not null default true,
  autoplay_next_surah boolean not null default false,
  download_wifi_only boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- Operations ----------
create table quran.import_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid references quran.quran_dataset_versions (id) on delete set null,
  pipeline_version text not null,
  mode text not null check (mode in ('dry-run', 'validate-only', 'import')),
  status text not null check (status in ('running', 'success', 'failed')),
  report jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table quran.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  actor_role text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on quran.audit_logs (created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'sources', 'quran_editions', 'quran_dataset_versions', 'qiraat', 'riwayat',
    'surahs', 'ayahs', 'juzs', 'hizbs', 'pages', 'manzils',
    'translations', 'ayah_translations', 'reciters', 'reciter_riwayat',
    'recitations', 'audio_files', 'tafsir_sources', 'ayah_tafsirs',
    'revelation_contexts', 'ayah_words', 'topics', 'ayah_topics',
    'user_bookmarks', 'user_favorites', 'user_reading_progress',
    'user_favorite_reciters', 'user_audio_progress', 'user_quran_settings',
    'import_runs', 'audit_logs'
  ]
  loop
    execute format('alter table quran.%I enable row level security', t);
    execute format('alter table quran.%I force row level security', t);
  end loop;

  -- Public catalogue: read-only for anon + authenticated. No insert/update/delete
  -- policies exist, so writes are impossible for those roles by construction.
  foreach t in array array[
    'sources', 'quran_editions', 'quran_dataset_versions', 'qiraat', 'riwayat',
    'surahs', 'ayahs', 'juzs', 'hizbs', 'pages', 'manzils',
    'translations', 'ayah_translations', 'reciters', 'reciter_riwayat',
    'recitations', 'audio_files', 'tafsir_sources', 'ayah_tafsirs',
    'revelation_contexts', 'ayah_words', 'topics', 'ayah_topics'
  ]
  loop
    execute format(
      'create policy %I on quran.%I for select to anon, authenticated using (true)',
      t || '_public_read', t);
    execute format('grant select on quran.%I to anon, authenticated', t);
    execute format('grant select, insert, update, delete on quran.%I to service_role', t);
  end loop;

  -- Owner-scoped user data.
  foreach t in array array[
    'user_bookmarks', 'user_favorites', 'user_reading_progress',
    'user_favorite_reciters', 'user_audio_progress'
  ]
  loop
    execute format(
      'create policy %I on quran.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t);
    execute format('grant select, insert, update, delete on quran.%I to authenticated', t);
    execute format('grant select, insert, update, delete on quran.%I to service_role', t);
  end loop;
end $$;

create policy user_quran_settings_owner on quran.user_quran_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on quran.user_quran_settings to authenticated;
grant select, insert, update, delete on quran.user_quran_settings to service_role;

-- Ops tables: service_role only (no policies for anon/authenticated).
grant select, insert, update on quran.import_runs to service_role;
grant select, insert on quran.audit_logs to service_role;
