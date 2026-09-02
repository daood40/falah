-- ============================================================
-- FALAH — v2 alignment migration (Directive v2 §26, §29, SOURCE_POLICY)
-- Cumulative on top of 0001_init.sql. Apply with: supabase db push
-- ============================================================

-- ---------- Verification pipeline persistence (SOURCE_POLICY) ----------
-- Every verification run over a sacred text leaves an auditable record:
-- which text, which checksum, which pipeline version, and the outcome.
create table verification_records (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('quran_ayah', 'hadith', 'translation', 'tafsir')),
  content_key text not null,               -- e.g. '2:255' or 'nawawi_1'
  checksum text not null,                  -- sha-256 of the verified text
  source_id text not null references content_sources (id),
  pipeline_version text not null,
  status text not null check (status in ('passed', 'failed', 'blocked')),
  details jsonb not null default '{}',
  verified_at timestamptz not null default now()
);
create index verification_records_key_idx on verification_records (content_type, content_key);
create index verification_records_status_idx on verification_records (status, verified_at desc);

-- ---------- RBAC (v2 §26 — five roles) ----------
create table user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'reviewer', 'sharia_reviewer', 'moderator', 'admin')),
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------- Hadith corpus growth (§8.3) ----------
create table hadith_chapters (
  id text primary key,                     -- e.g. 'bukhari_c1'
  book_id text not null references hadith_books (id),
  number int not null,
  name_ar text not null,
  name_en text,
  unique (book_id, number)
);

create table hadith_narrators (
  id text primary key,                     -- e.g. 'abu-hurairah'
  name_ar text not null,
  name_en text,
  bio text
);

create table hadith_narrations (
  hadith_id text not null references hadiths (id) on delete cascade,
  narrator_id text not null references hadith_narrators (id),
  position int not null default 1,         -- order in the isnad chain
  primary key (hadith_id, narrator_id)
);

-- ---------- Source requests (SOURCE_POLICY intake queue) ----------
create table source_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tafsir', 'hadith_book', 'translation', 'reciter', 'other')),
  name text not null,
  url text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index source_requests_status_idx on source_requests (status, created_at);

-- ---------- Publish attempt audit (§21 honest publishing) ----------
create table publish_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_post_id uuid not null references scheduled_posts (id) on delete cascade,
  attempt int not null check (attempt >= 1),
  idempotency_key text not null,
  status text not null check (status in ('success', 'failed')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (scheduled_post_id, attempt)
);
create index publish_attempts_post_idx on publish_attempts (scheduled_post_id, started_at desc);

-- ---------- Reports (§26 moderation intake) ----------
create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('project', 'template', 'source', 'other')),
  target_id text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on reports (status, created_at);

-- ---------- Library organization (§29: folders, tags) ----------
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table content_projects
  add column folder_id uuid references folders (id) on delete set null;

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table project_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references content_projects (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (project_id, tag_id)
);

-- ---------- Server-side counterparts of local-first features ----------
-- Structure-only user templates (no sacred text inside — enforced app-side
-- and testable: elements carry roles/styles/positions, never text bodies).
create table user_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  format_id text not null,
  background jsonb not null default '{}',
  elements_structure jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index user_templates_user_idx on user_templates (user_id, created_at desc);

create table project_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references content_projects (id) on delete cascade,
  snapshot jsonb not null,
  saved_at timestamptz not null default now()
);
create index project_versions_project_idx on project_versions (project_id, saved_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table verification_records enable row level security;
alter table user_roles enable row level security;
alter table hadith_chapters enable row level security;
alter table hadith_narrators enable row level security;
alter table hadith_narrations enable row level security;
alter table source_requests enable row level security;
alter table publish_attempts enable row level security;
alter table reports enable row level security;
alter table folders enable row level security;
alter table tags enable row level security;
alter table project_tags enable row level security;
alter table user_templates enable row level security;
alter table project_versions enable row level security;

-- Reference data: public read; writes only via service_role (bypasses RLS).
create policy "verification: public read" on verification_records for select using (true);
create policy "chapters: public read" on hadith_chapters for select using (true);
create policy "narrators: public read" on hadith_narrators for select using (true);
create policy "narrations: public read" on hadith_narrations for select using (true);

-- Roles: a user may see their own roles; grants happen via service_role only.
create policy "roles: owner read" on user_roles
  for select using (auth.uid() = user_id);

-- Owner data
create policy "source_requests: owner insert" on source_requests
  for insert with check (auth.uid() = user_id);
create policy "source_requests: owner read" on source_requests
  for select using (auth.uid() = user_id);
create policy "publish_attempts: owner read" on publish_attempts
  for select using (auth.uid() = user_id);
create policy "reports: owner insert" on reports
  for insert with check (auth.uid() = user_id);
create policy "reports: owner read" on reports
  for select using (auth.uid() = user_id);
create policy "folders: owner all" on folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags: owner all" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "project_tags: owner all" on project_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_templates: owner all" on user_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "project_versions: owner all" on project_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
