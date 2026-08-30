-- ============================================================================
-- Modular App Ecosystem — foundation schema
--
-- Security model, in one paragraph:
--   Every row in this database belongs to exactly one owner. Row Level Security
--   is the enforcement point, not application code, so a bug in a page or an
--   action cannot leak another tenant's data. Anonymous visitors get exactly
--   two capabilities, both narrow: reading rows in collections an install has
--   explicitly marked public-readable, and calling one rate-limited function to
--   submit into collections marked public-writable. They have no direct INSERT,
--   UPDATE or DELETE on anything.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one per auth user, and the owner of the public page
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null
    check (handle ~ '^[a-z0-9][a-z0-9_-]{1,30}$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 400),
  accent text not null default '#636ef1' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  -- The public page is off until the owner deliberately turns it on.
  page_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Handles are compared case-insensitively when resolving a public URL.
create index profiles_handle_lower_idx on public.profiles (lower(handle));

-- ---------------------------------------------------------------------------
-- installs: one owner's copy of one module — the "container"
--
-- public_read_collections / public_write_collections are derived from the
-- module manifest at install time and are what RLS actually consults. The
-- manifest itself is never trusted at read time; only these stored, validated
-- lists are.
-- ---------------------------------------------------------------------------
create table public.installs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  module_id text not null check (module_id ~ '^[a-z][a-z0-9-]*$'),
  module_version text not null check (module_version ~ '^\d+\.\d+\.\d+$'),
  -- URL segment under the owner's public page: /u/<handle>/<slug>
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  config jsonb not null default '{}'::jsonb,
  granted_permissions text[] not null default '{}',
  enabled boolean not null default true,
  -- Whether this container appears on the owner's public page.
  public_enabled boolean not null default false,
  public_position integer not null default 0,
  public_read_collections text[] not null default '{}',
  public_write_collections text[] not null default '{}',
  -- Owner can pause public writes without unpublishing (closing the queue).
  accepting_submissions boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index installs_owner_idx on public.installs (owner_id);
create index installs_public_idx on public.installs (owner_id, public_enabled, public_position);

-- ---------------------------------------------------------------------------
-- records: every row every module stores, partitioned logically by install
--
-- owner_id is denormalised from installs so RLS can authorise without a join.
-- A trigger keeps it honest; it is never taken from the client.
-- ---------------------------------------------------------------------------
create table public.records (
  id uuid primary key default gen_random_uuid(),
  install_id uuid not null references public.installs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  collection text not null check (collection ~ '^[a-z][a-z0-9_]*$'),
  data jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  -- Set for rows created by an anonymous visitor rather than the owner.
  submitted_by_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A single record's payload is capped so no one module can bloat the table.
  constraint records_data_size check (pg_column_size(data) <= 16384)
);

create index records_install_collection_idx
  on public.records (install_id, collection, position, created_at desc);

-- ---------------------------------------------------------------------------
-- module_listings: the marketplace side, present from day one so that
-- publishing and selling never require a schema retrofit
-- ---------------------------------------------------------------------------
create table public.module_listings (
  id uuid primary key default gen_random_uuid(),
  module_id text not null check (module_id ~ '^[a-z][a-z0-9-]*$'),
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  author_id uuid references public.profiles (id) on delete set null,
  -- The validated manifest, exactly as `parseManifest` accepted it.
  manifest jsonb not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  pricing_model text not null default 'free'
    check (pricing_model in ('free', 'one_time', 'subscription')),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'published', 'delisted')),
  install_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (module_id, version)
);

create index module_listings_published_idx
  on public.module_listings (status, created_at desc);

-- ---------------------------------------------------------------------------
-- public_submission_log: the rate-limit ledger for anonymous writes
--
-- A public form is an open write endpoint on our infrastructure. This table is
-- what stops one visitor from turning it into a firehose.
-- ---------------------------------------------------------------------------
create table public.public_submission_log (
  id bigserial primary key,
  install_id uuid not null references public.installs (id) on delete cascade,
  -- Hashed client fingerprint. We never store a raw IP address.
  client_hash text not null,
  created_at timestamptz not null default now()
);

create index public_submission_log_window_idx
  on public.public_submission_log (install_id, client_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger installs_touch before update on public.installs
  for each row execute function public.touch_updated_at();
create trigger records_touch before update on public.records
  for each row execute function public.touch_updated_at();

-- owner_id on a record is always derived from its install, never from input.
create or replace function public.records_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select owner_id into new.owner_id from public.installs where id = new.install_id;

  if new.owner_id is null then
    raise exception 'Unknown install %', new.install_id;
  end if;

  return new;
end;
$$;

create trigger records_owner before insert or update of install_id on public.records
  for each row execute function public.records_set_owner();

-- A profile row is created for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix integer := 0;
begin
  base := regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_-]', '', 'g');

  -- A handle must start with a letter or digit and be at least two characters.
  base := regexp_replace(base, '^[_-]+', '');

  if char_length(base) < 2 then
    base := 'user';
  end if;

  base := left(base, 24);
  candidate := base;

  while exists (select 1 from public.profiles where handle = candidate) loop
    suffix := suffix + 1;
    candidate := base || suffix::text;
  end loop;

  insert into public.profiles (id, handle, display_name)
  values (new.id, candidate, '');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
