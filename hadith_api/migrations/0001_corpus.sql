-- ============================================================
-- FALAH — Hadith Corpus backend (schema: corpus)
-- Multi-source, multi-edition hadith dataset with SOURCE_LOCK.
-- Cumulative on top of 0002_v2.sql. Apply with: supabase db push
--
-- Namespaced under `corpus` so it never collides with the app-side
-- `public.hadiths` seed corpus of 0001_init.sql.
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists corpus;

-- ---------- helpers ----------
create or replace function corpus.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- sha-256 of the text exactly as stored (SOURCE_POLICY §hash).
create or replace function corpus.sha256_hex(t text) returns text
language sql immutable strict as $$
  select encode(digest(t, 'sha256'), 'hex')
$$;

-- ---------- sources ----------
create table corpus.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  url text,
  publisher text,
  country text,
  language text not null default 'ar',
  source_type text not null default 'book'
    check (source_type in ('book', 'website', 'api', 'manuscript', 'user_supplied_file')),
  license_status text not null default 'unconfirmed'
    check (license_status in ('unconfirmed', 'pending_review', 'confirmed', 'restricted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- dataset versions ----------
create table corpus.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,            -- e.g. 'JAMI-KAMIL-1437-V1'
  source_id uuid references corpus.sources (id) on delete restrict,
  description text,
  is_active boolean not null default false,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- editions ----------
create table corpus.editions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references corpus.sources (id) on delete restrict,
  slug text not null unique,
  title text not null,
  author text,
  publisher text,
  edition_name text,
  edition_number int check (edition_number > 0),
  publication_year int check (publication_year between 1 and 2200),
  hijri_year int check (hijri_year between 1 and 2000),
  volume_count int check (volume_count > 0),
  isbn text,
  page_count int check (page_count > 0),
  source_url text,
  dataset_version text references corpus.dataset_versions (version),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index editions_source_idx on corpus.editions (source_id);

-- ---------- books (a source/edition may hold several كتب/أقسام) ----------
create table corpus.books (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references corpus.editions (id) on delete cascade,
  external_key text,                       -- stable key from the source file
  name text not null,
  order_number int,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, external_key)
);
create index books_edition_idx on corpus.books (edition_id, order_number);

-- ---------- chapters (hierarchical أبواب) ----------
create table corpus.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references corpus.books (id) on delete cascade,
  parent_id uuid references corpus.chapters (id) on delete cascade,
  external_key text,
  name text not null,
  chapter_number text,                     -- kept as text: sources use '12', '12/أ'
  order_number int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, external_key)
);
create index chapters_book_idx on corpus.chapters (book_id, order_number);
create index chapters_parent_idx on corpus.chapters (parent_id);

-- ---------- narrators ----------
create table corpus.narrators (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references corpus.editions (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  kunya text,
  laqab text,
  biography text,                          -- only if present in the source
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, normalized_name)
);
create index narrators_normalized_idx on corpus.narrators (normalized_name);

-- ---------- hadiths ----------
create table corpus.hadiths (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references corpus.editions (id) on delete cascade,
  book_id uuid references corpus.books (id) on delete set null,
  chapter_id uuid references corpus.chapters (id) on delete set null,

  hadith_number text,                      -- text: sources use '12', '12م', '12/2'
  hadith_number_int int,                   -- numeric part when unambiguous, else null
  volume_number int check (volume_number > 0),
  page_number int check (page_number > 0),

  -- raw_text is the text exactly as extracted. Never AI-authored, never edited.
  raw_text text not null check (length(btrim(raw_text)) > 0),
  matn text,                               -- null unless the source separates it
  isnad text,                              -- null unless the source separates it

  narrator_id uuid references corpus.narrators (id) on delete set null,

  takhrij text,                            -- as written in the source
  grading text,                            -- as written in the source

  original_reference text,
  original_hadith_number text,

  source_locked boolean not null default true,
  verified boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'needs_review', 'rejected')),

  -- authoritative: the database computes the hash, the importer only verifies it
  content_hash text generated always as (encode(digest(raw_text, 'sha256'), 'hex')) stored,

  dataset_version text not null references corpus.dataset_versions (version),
  raw_import_id uuid,                      -- FK added after raw_imports exists

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- verified=true is only reachable through the verification pipeline
  constraint hadiths_verified_consistent
    check ((verified = false) or (verification_status = 'verified'))
);
create index hadiths_edition_idx on corpus.hadiths (edition_id);
create index hadiths_book_idx on corpus.hadiths (book_id);
create index hadiths_chapter_idx on corpus.hadiths (chapter_id);
create index hadiths_narrator_idx on corpus.hadiths (narrator_id);
create index hadiths_number_idx on corpus.hadiths (edition_id, hadith_number);
create index hadiths_number_int_idx on corpus.hadiths (hadith_number_int);
create index hadiths_volume_page_idx on corpus.hadiths (volume_number, page_number);
create index hadiths_dataset_idx on corpus.hadiths (dataset_version);
create index hadiths_verification_idx on corpus.hadiths (verification_status);
create index hadiths_content_hash_idx on corpus.hadiths (content_hash);
-- the same text may legitimately recur as a different رواية; uniqueness is
-- (dataset, edition, hadith_number) only — never the text itself (§37).
create unique index hadiths_number_unique
  on corpus.hadiths (dataset_version, edition_id, hadith_number)
  where hadith_number is not null;

-- ---------- hadith ↔ narrator (many-to-many, ordered isnad chain) ----------
create table corpus.hadith_narrators (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references corpus.hadiths (id) on delete cascade,
  narrator_id uuid not null references corpus.narrators (id) on delete cascade,
  position int,                            -- order within the isnad if the source gives one
  role text,                               -- e.g. 'راوي الحديث' as written in the source
  created_at timestamptz not null default now(),
  unique (hadith_id, narrator_id, position)
);
create index hadith_narrators_hadith_idx on corpus.hadith_narrators (hadith_id);
create index hadith_narrators_narrator_idx on corpus.hadith_narrators (narrator_id);

-- ---------- takhrij targets (البخاري/مسلم/… as written in the source) ----------
create table corpus.hadith_sources (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references corpus.hadiths (id) on delete cascade,
  source_name text not null,               -- verbatim from the source
  source_id uuid references corpus.sources (id) on delete set null,
  reference text,                          -- e.g. 'كتاب الإيمان' as written
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);
create index hadith_sources_hadith_idx on corpus.hadith_sources (hadith_id);
create index hadith_sources_name_idx on corpus.hadith_sources (source_name);

-- ---------- gradings (verbatim, never inferred) ----------
create table corpus.hadith_gradings (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references corpus.hadiths (id) on delete cascade,
  grading text not null,
  grader text,
  source_reference text,
  notes text,
  created_at timestamptz not null default now()
);
create index hadith_gradings_hadith_idx on corpus.hadith_gradings (hadith_id);

-- ---------- cross references (آية/حديث آخر/صفحة) ----------
create table corpus.hadith_references (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references corpus.hadiths (id) on delete cascade,
  reference_type text not null
    check (reference_type in ('quran', 'hadith', 'book', 'page', 'other')),
  reference_text text not null,
  target_hadith_id uuid references corpus.hadiths (id) on delete set null,
  created_at timestamptz not null default now()
);
create index hadith_references_hadith_idx on corpus.hadith_references (hadith_id);

-- ---------- raw imports (RAW → PARSE → VALIDATE → IMPORT → VERIFY) ----------
create table corpus.raw_imports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references corpus.sources (id) on delete set null,
  edition_id uuid references corpus.editions (id) on delete set null,
  dataset_version text references corpus.dataset_versions (version),
  adapter text not null,
  file_name text,
  file_hash text,                          -- sha-256 of the input file
  dry_run boolean not null default false,
  import_started_at timestamptz not null default now(),
  import_completed_at timestamptz,
  total_records int not null default 0,
  successful_records int not null default 0,
  failed_records int not null default 0,
  skipped_records int not null default 0,
  duplicate_records int not null default 0,
  validation_errors jsonb not null default '[]',
  report jsonb not null default '{}',
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'dry_run')),
  created_at timestamptz not null default now()
);
create index raw_imports_status_idx on corpus.raw_imports (status, created_at desc);

alter table corpus.hadiths
  add constraint hadiths_raw_import_fk
  foreign key (raw_import_id) references corpus.raw_imports (id) on delete set null;

-- ---------- verification records ----------
create table corpus.verification_records (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references corpus.hadiths (id) on delete cascade,
  verification_type text not null
    check (verification_type in ('manual_sample', 'hash_check', 'structural', 'external_source')),
  verified_by text,                        -- human/pipeline identity, never 'AI'
  verification_date timestamptz not null default now(),
  source_reference text,
  notes text,
  content_hash text not null,              -- the hash that was verified
  result text not null default 'passed' check (result in ('passed', 'failed', 'inconclusive')),
  created_at timestamptz not null default now()
);
create index verification_records_hadith_idx on corpus.verification_records (hadith_id);

-- ---------- audit logs ----------
create table corpus.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,                              -- user id / 'importer' / 'system'
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on corpus.audit_logs (created_at desc);
create index audit_logs_entity_idx on corpus.audit_logs (entity_type, entity_id);

-- ---------- runtime settings (feature flags readable from SQL) ----------
create table corpus.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into corpus.app_settings (key, value)
  values ('content_license_confirmed', 'false')
  on conflict (key) do nothing;

create or replace function corpus.content_license_confirmed() returns boolean
language sql stable as $$
  select coalesce((select value = 'true' from corpus.app_settings
                   where key = 'content_license_confirmed'), false)
$$;

-- ---------- SOURCE_LOCK enforcement (§25) ----------
-- Locked religious text is immutable in place. A correction means a new
-- dataset_version, never an UPDATE of the historical row.
create or replace function corpus.enforce_source_lock() returns trigger
language plpgsql as $$
begin
  if old.source_locked and coalesce(current_setting('corpus.allow_source_write', true), 'off') <> 'on' then
    if new.raw_text is distinct from old.raw_text
       or new.matn is distinct from old.matn
       or new.isnad is distinct from old.isnad
       or new.takhrij is distinct from old.takhrij
       or new.grading is distinct from old.grading
       or new.hadith_number is distinct from old.hadith_number
       or new.original_reference is distinct from old.original_reference
       or new.original_hadith_number is distinct from old.original_hadith_number
       or new.edition_id is distinct from old.edition_id
       or new.dataset_version is distinct from old.dataset_version
       or new.source_locked is distinct from old.source_locked then
      raise exception 'SOURCE_LOCK: hadith % is source-locked; import a new dataset_version instead', old.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger hadiths_source_lock
  before update on corpus.hadiths
  for each row execute function corpus.enforce_source_lock();

-- DELETE of locked text is likewise refused (§37 — no blind dedup/cleanup).
create or replace function corpus.refuse_locked_delete() returns trigger
language plpgsql as $$
begin
  if old.source_locked and coalesce(current_setting('corpus.allow_source_write', true), 'off') <> 'on' then
    raise exception 'SOURCE_LOCK: hadith % is source-locked and cannot be deleted', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end $$;

create trigger hadiths_locked_delete
  before delete on corpus.hadiths
  for each row execute function corpus.refuse_locked_delete();

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['sources','dataset_versions','editions','books','chapters','narrators','hadiths']
  loop
    execute format(
      'create trigger %I_touch before update on corpus.%I for each row execute function corpus.touch_updated_at()',
      t, t);
  end loop;
end $$;

-- ============================================================
-- Seed: source + edition metadata for
-- «الجامع الكامل في الحديث الصحيح الشامل» (metadata only — no text).
-- Every field below is stated by the project owner; nothing is inferred.
-- ============================================================
insert into corpus.sources (slug, name, description, url, publisher, country, language, source_type, license_status)
values (
  'ketabonline-62920',
  E'ketabonline — الجامع الكامل في الحديث الصحيح الشامل',
  E'المصدر الرقمي المرجعي للطبعة؛ لا يُستورد منه نص إلا من ملف يملك صاحب المشروع حق استخدامه.',
  'https://ketabonline.com/ar/books/62920',
  E'دار السلام للنشر والتوزيع – الرياض',
  'SA', 'ar', 'website', 'unconfirmed'
) on conflict (slug) do nothing;

insert into corpus.dataset_versions (version, source_id, description, is_active, released_at)
select 'JAMI-KAMIL-1437-V1', s.id,
       E'النسخة الأولى من مجموعة بيانات الجامع الكامل — لا تُملأ إلا من ملف مصدر مصرّح به.',
       true, null
from corpus.sources s where s.slug = 'ketabonline-62920'
on conflict (version) do nothing;

insert into corpus.editions (
  source_id, slug, title, author, publisher, edition_number,
  publication_year, hijri_year, volume_count, source_url, dataset_version)
select s.id, 'jami-kamil-1437',
  E'الجامع الكامل في الحديث الصحيح الشامل',
  E'محمد عبد الله الأعظمي المعروف بالضياء',
  E'دار السلام للنشر والتوزيع – الرياض',
  1, 2016, 1437, 12,
  'https://ketabonline.com/ar/books/62920',
  'JAMI-KAMIL-1437-V1'
from corpus.sources s where s.slug = 'ketabonline-62920'
on conflict (slug) do nothing;
