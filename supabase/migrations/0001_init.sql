-- ============================================================
-- FALAH — initial schema (PostgreSQL / Supabase)
-- Apply with: supabase db push   (or psql -f on plain Postgres)
-- ============================================================

create extension if not exists pgcrypto;

-- On plain Postgres (outside Supabase) create a stand-in for auth.users / auth.uid()
-- so this migration is testable anywhere. On Supabase these already exist.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable
      as $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
  end if;
end $$;

-- ---------- Users / profiles ----------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Sources (audit-able registry for every religious text) ----------
create table content_sources (
  id text primary key,                     -- e.g. 'tanzil-uthmani'
  name text not null,
  url text not null,
  version text not null,
  license text,
  verified_at timestamptz,
  review_status text not null default 'pending_review'
    check (review_status in ('verified', 'pending_review', 'blocked')),
  created_at timestamptz not null default now()
);

-- ---------- Quran ----------
create table quran_surahs (
  number int primary key check (number between 1 and 114),
  name_ar text not null,
  transliteration text not null,
  revelation text not null check (revelation in ('meccan', 'medinan')),
  ayah_count int not null check (ayah_count > 0)
);

create table quran_ayahs (
  id bigint generated always as identity primary key,
  surah int not null references quran_surahs (number),
  ayah int not null check (ayah > 0),
  arabic_text text not null,
  juz int,
  hizb int,
  page int,
  checksum text not null,                  -- sha-256 of arabic_text (source lock)
  source_id text not null references content_sources (id),
  unique (surah, ayah, source_id)
);
create index quran_ayahs_surah_idx on quran_ayahs (surah);

create table quran_translations (
  id bigint generated always as identity primary key,
  surah int not null,
  ayah int not null,
  lang text not null,
  translator text not null,
  text text not null,
  source_id text not null references content_sources (id),
  unique (surah, ayah, lang, translator)
);
create index quran_translations_ayah_idx on quran_translations (surah, ayah, lang);

create table quran_tafsirs (
  id bigint generated always as identity primary key,
  surah int not null,
  ayah int not null,
  tafsir_name text not null,
  lang text not null default 'ar',
  text text not null,
  source_id text not null references content_sources (id),
  unique (surah, ayah, tafsir_name)
);

create table reciters (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  cdn_edition text not null
);

create table recitations (
  id bigint generated always as identity primary key,
  reciter_id text not null references reciters (id),
  surah int not null,
  ayah int not null,
  audio_url text not null,
  unique (reciter_id, surah, ayah)
);

-- ---------- Hadith ----------
create table hadith_books (
  id text primary key,                     -- e.g. 'nawawi40', 'bukhari'
  name_ar text not null,
  name_en text not null,
  compiler text,
  source_url text
);

create table hadiths (
  id text primary key,                     -- e.g. 'nawawi_1'
  book_id text not null references hadith_books (id),
  number int not null,
  arabic_text text not null,
  narrator text,
  chapter text,
  checksum text not null,
  source_id text not null references content_sources (id),
  unique (book_id, number)
);
create index hadiths_book_idx on hadiths (book_id);

create table hadith_translations (
  id bigint generated always as identity primary key,
  hadith_id text not null references hadiths (id) on delete cascade,
  lang text not null,
  text text not null,
  source_id text not null references content_sources (id),
  unique (hadith_id, lang)
);

-- Grades live in their own table: a grade always names WHO graded (source lock —
-- no unattributed authenticity claims).
create table hadith_grades (
  id bigint generated always as identity primary key,
  hadith_id text not null references hadiths (id) on delete cascade,
  grade text not null,
  graded_by text not null,
  source_id text not null references content_sources (id),
  unique (hadith_id, graded_by)
);

-- ---------- Content projects ----------
create table content_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  type text not null check (type in ('post', 'story', 'reel', 'video')),
  format_id text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  favorite boolean not null default false,
  background jsonb not null default '{}',
  elements jsonb not null default '[]',
  video_settings jsonb,
  thumbnail_path text,                     -- storage object path (not inline data)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_projects_user_idx on content_projects (user_id, updated_at desc);
create index content_projects_status_idx on content_projects (user_id, status);

create table content_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references content_projects (id) on delete cascade,
  kind text not null check (kind in ('image', 'audio', 'video', 'export')),
  storage_path text not null,
  bytes bigint not null default 0,
  created_at timestamptz not null default now()
);
create index content_assets_user_idx on content_assets (user_id);

create table templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  premium boolean not null default false,
  format_id text not null,
  background jsonb not null,
  elements jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- Scheduling / publishing ----------
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null
    check (platform in ('instagram', 'facebook', 'tiktok', 'youtube', 'telegram', 'x')),
  account_name text not null,
  -- OAuth tokens are stored encrypted by edge functions (pgsodium/vault);
  -- never exposed through the API.
  encrypted_credentials bytea,
  connected_at timestamptz not null default now(),
  unique (user_id, platform, account_name)
);

create table scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references content_projects (id) on delete cascade,
  platform text not null,
  scheduled_at timestamptz not null,
  repeat_rule text not null default 'none' check (repeat_rule in ('none', 'daily', 'weekly')),
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  last_error text,
  remote_post_id text,
  created_at timestamptz not null default now()
);
create index scheduled_posts_due_idx on scheduled_posts (status, scheduled_at);
create index scheduled_posts_user_idx on scheduled_posts (user_id, scheduled_at);

-- ---------- Subscriptions (entitlements are backend data, not UI constants) ----------
create table subscription_plans (
  id text primary key check (id in ('free', 'pro', 'premium')),
  price_usd_month numeric(8, 2) not null default 0,
  entitlements jsonb not null
);

insert into subscription_plans (id, price_usd_month, entitlements) values
  ('free', 0, '{"max_projects":20,"max_exports_per_month":30,"max_video_resolution":720,"scheduled_posts":5,"ai_messages_per_day":20,"storage_limit_mb":200,"premium_templates":false}'),
  ('pro', 9.99, '{"max_projects":200,"max_exports_per_month":500,"max_video_resolution":1080,"scheduled_posts":100,"ai_messages_per_day":200,"storage_limit_mb":2048,"premium_templates":true}'),
  ('premium', 19.99, '{"max_projects":-1,"max_exports_per_month":-1,"max_video_resolution":2160,"scheduled_posts":-1,"ai_messages_per_day":1000,"storage_limit_mb":10240,"premium_templates":true}');

create table subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null references subscription_plans (id) default 'free',
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------- Notifications ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, read, created_at desc);

-- ---------- Audit ----------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_user_idx on audit_logs (user_id, created_at desc);
create index audit_logs_action_idx on audit_logs (action, created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table content_projects enable row level security;
alter table content_assets enable row level security;
alter table social_accounts enable row level security;
alter table scheduled_posts enable row level security;
alter table subscriptions enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- Public read-only reference data stays without RLS-owner policies but is
-- protected against writes from the anon/authenticated roles by RLS default-deny.
alter table content_sources enable row level security;
alter table quran_surahs enable row level security;
alter table quran_ayahs enable row level security;
alter table quran_translations enable row level security;
alter table quran_tafsirs enable row level security;
alter table reciters enable row level security;
alter table recitations enable row level security;
alter table hadith_books enable row level security;
alter table hadiths enable row level security;
alter table hadith_translations enable row level security;
alter table hadith_grades enable row level security;
alter table templates enable row level security;
alter table subscription_plans enable row level security;

-- Owner policies
create policy "profiles: owner all" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "projects: owner all" on content_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assets: owner all" on content_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "social: owner all" on social_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scheduled: owner all" on scheduled_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions: owner read" on subscriptions
  for select using (auth.uid() = user_id);
create policy "notifications: owner read" on notifications
  for select using (auth.uid() = user_id);
create policy "notifications: owner update" on notifications
  for update using (auth.uid() = user_id);
-- Audit: users may write their own entries and read their own; never delete/update.
create policy "audit: owner insert" on audit_logs
  for insert with check (auth.uid() = user_id);
create policy "audit: owner read" on audit_logs
  for select using (auth.uid() = user_id);

-- Reference data: readable by everyone; writable only by service_role (bypasses RLS).
create policy "sources: public read" on content_sources for select using (true);
create policy "surahs: public read" on quran_surahs for select using (true);
create policy "ayahs: public read" on quran_ayahs for select using (true);
create policy "translations: public read" on quran_translations for select using (true);
create policy "tafsirs: public read" on quran_tafsirs for select using (true);
create policy "reciters: public read" on reciters for select using (true);
create policy "recitations: public read" on recitations for select using (true);
create policy "hadith_books: public read" on hadith_books for select using (true);
create policy "hadiths: public read" on hadiths for select using (true);
create policy "hadith_translations: public read" on hadith_translations for select using (true);
create policy "hadith_grades: public read" on hadith_grades for select using (true);
create policy "templates: public read" on templates for select using (true);
create policy "plans: public read" on subscription_plans for select using (true);

-- ---------- updated_at triggers ----------
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger projects_updated before update on content_projects
  for each row execute function set_updated_at();
create trigger subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();

-- ---------- Seed reference sources ----------
insert into content_sources (id, name, url, version, license, verified_at, review_status) values
  ('tanzil-uthmani', 'Tanzil Project — Quran Uthmani', 'https://tanzil.net', 'quran-json@3.1.2', 'CC BY-ND (Tanzil terms)', now(), 'verified'),
  ('en-sahih-international', 'Sahih International translation', 'https://tanzil.net/trans/', 'quran-json@3.1.2', 'CC BY 4.0 (via quran-json)', now(), 'verified'),
  ('nawawi40', E'الأربعون النووية — Nawawi''s 40 Hadith', 'https://sunnah.com/nawawi40', '@kazishariar/nawawi-40-hadith-data@1.0.3', 'MIT (dataset packaging)', now(), 'verified'),
  ('ar-muyassar', 'التفسير الميسر — King Fahd Complex', 'https://tanzil.net/tafsirs/', 'alquran.cloud ar.muyassar', 'public', now(), 'verified');

insert into hadith_books (id, name_ar, name_en, compiler, source_url) values
  ('nawawi40', 'الأربعون النووية', E'Al-Arba''in An-Nawawiyyah', 'الإمام يحيى بن شرف النووي', 'https://sunnah.com/nawawi40');

insert into reciters (id, name_ar, name_en, cdn_edition) values
  ('alafasy', 'مشاري العفاسي', 'Mishary Alafasy', 'ar.alafasy'),
  ('husary', 'محمود خليل الحصري', 'Mahmoud Al-Husary', 'ar.husary'),
  ('abdulbasit', 'عبد الباسط عبد الصمد', 'Abdul Basit', 'ar.abdulbasitmurattal'),
  ('minshawi', 'محمد صديق المنشاوي', 'Al-Minshawi', 'ar.minshawi');
