-- ============================================================================
-- Page design and reusable layouts
--
-- Two additions:
--   1. Owners can restyle their public page and choose how each block displays.
--   2. A layout — a theme plus an ordered plan of blocks — becomes a shareable
--      artifact in its own right. Publish one and anybody can start from it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Page design lives on the profile: one theme per public page.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column theme jsonb not null default '{}'::jsonb,
  add column avatar_url text,
  add column tagline text not null default '' check (char_length(tagline) <= 120),
  -- Free-form owner-authored HTML is never stored or rendered; the theme is a
  -- validated set of named options and nothing else.
  add constraint profiles_theme_size check (pg_column_size(theme) <= 4096);

-- ---------------------------------------------------------------------------
-- How an individual block presents itself. The runtime clamps this to the
-- variants its template actually supports, so a stale value renders safely.
-- ---------------------------------------------------------------------------
alter table public.installs
  add column display_variant text
    check (display_variant is null or display_variant ~ '^[a-z]{2,20}$'),
  add column public_heading text check (public_heading is null or char_length(public_heading) <= 80);

-- ---------------------------------------------------------------------------
-- page_templates: a reusable layout anyone can apply
--
-- `plan` is an ordered list of blocks, each naming a module id, a label and a
-- display variant. Applying a template installs what is missing and restyles
-- the page. It carries no data — only the shape.
-- ---------------------------------------------------------------------------
create table public.page_templates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  category text not null default 'general'
    check (category in ('general', 'hospitality', 'events', 'commerce', 'content', 'operations', 'personal')),
  theme jsonb not null default '{}'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  -- Templates that ship with the platform, rather than user submissions.
  is_builtin boolean not null default false,
  is_public boolean not null default false,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_templates_payload_size
    check (pg_column_size(theme) <= 4096 and pg_column_size(plan) <= 16384)
);

create index page_templates_public_idx
  on public.page_templates (is_public, use_count desc, created_at desc);
create index page_templates_author_idx on public.page_templates (author_id);

create trigger page_templates_touch before update on public.page_templates
  for each row execute function public.touch_updated_at();

alter table public.page_templates enable row level security;

create policy "public templates are readable by everyone"
  on public.page_templates for select
  to anon, authenticated
  using (is_public = true);

create policy "authors read their own templates"
  on public.page_templates for select
  using (auth.uid() = author_id);

-- Authors may create and edit their own templates, but never mark one builtin.
create policy "authors create their own templates"
  on public.page_templates for insert
  to authenticated
  with check (auth.uid() = author_id and is_builtin = false);

create policy "authors update their own templates"
  on public.page_templates for update
  using (auth.uid() = author_id and is_builtin = false)
  with check (auth.uid() = author_id and is_builtin = false);

create policy "authors delete their own templates"
  on public.page_templates for delete
  using (auth.uid() = author_id and is_builtin = false);

-- ---------------------------------------------------------------------------
-- Counting a use must not require write access to someone else's template,
-- so it goes through a definer function that can only ever increment.
-- ---------------------------------------------------------------------------
create or replace function public.increment_template_use(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.page_templates
  set use_count = use_count + 1
  where id = p_template_id and is_public = true;
end;
$$;

revoke all on function public.increment_template_use(uuid) from public;
grant execute on function public.increment_template_use(uuid) to authenticated;
