-- ============================================================================
-- Modules become data.
--
-- Until now the catalogue of apps was a code array: adding an app meant editing
-- the repository and redeploying, and no user could ever create or sell one.
-- That contradicted the whole point of the platform.
--
-- From here a module is a row. Anyone can author one from the dashboard, keep
-- it private, share it by link, or publish it to the store. The apps that ship
-- with the platform are seeded as ordinary rows with no special powers beyond
-- an author-less "builtin" badge.
-- ============================================================================

alter table public.module_listings
  add column is_builtin boolean not null default false,
  add column visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  add column updated_at timestamptz not null default now(),
  -- A manifest is a description, not a payload. This keeps it that way.
  add constraint module_listings_manifest_size check (pg_column_size(manifest) <= 65536);

-- 'in_review' was speculative; the real states are draft, published, delisted.
alter table public.module_listings drop constraint module_listings_status_check;
alter table public.module_listings
  add constraint module_listings_status_check
    check (status in ('draft', 'published', 'delisted'));

create index module_listings_catalogue_idx
  on public.module_listings (visibility, status, install_count desc);
create index module_listings_module_idx on public.module_listings (module_id, created_at desc);

create trigger module_listings_touch before update on public.module_listings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Readability
--
-- Replaces the old "published listings are readable" policy. Unlisted modules
-- are readable by anyone holding the id — that is what makes a private share
-- link work — but the store only ever queries for public ones.
-- ---------------------------------------------------------------------------
drop policy "published listings are readable" on public.module_listings;

create policy "shared modules are readable"
  on public.module_listings for select
  to anon, authenticated
  using (status = 'published' and visibility in ('public', 'unlisted'));

-- Authors may never mint a builtin, nor hand their module to someone else.
drop policy "authors manage their own listings" on public.module_listings;

create policy "authors read their own modules"
  on public.module_listings for select
  using (auth.uid() = author_id);

create policy "authors create their own modules"
  on public.module_listings for insert
  to authenticated
  with check (auth.uid() = author_id and is_builtin = false);

create policy "authors update their own modules"
  on public.module_listings for update
  using (auth.uid() = author_id and is_builtin = false)
  with check (auth.uid() = author_id and is_builtin = false);

create policy "authors delete their own modules"
  on public.module_listings for delete
  using (auth.uid() = author_id and is_builtin = false);

-- ---------------------------------------------------------------------------
-- Installs pin the manifest they were installed with.
--
-- This is the isolation guarantee. An author editing or deleting their module
-- cannot change, break or remove an app already running on someone else's
-- account: the runtime reads the pinned copy, never the author's current one.
-- Upgrading is an explicit act by the owner, not a side effect of someone
-- else's edit.
-- ---------------------------------------------------------------------------
alter table public.installs
  add column listing_id uuid references public.module_listings (id) on delete set null,
  add column manifest jsonb,
  add constraint installs_manifest_size
    check (manifest is null or pg_column_size(manifest) <= 65536);

create index installs_listing_idx on public.installs (listing_id);

-- ---------------------------------------------------------------------------
-- Counting an install must not require write access to someone else's module.
-- ---------------------------------------------------------------------------
create or replace function public.increment_module_installs(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.module_listings
  set install_count = install_count + 1
  where id = p_listing_id
    and status = 'published'
    and visibility in ('public', 'unlisted');
end;
$$;

revoke all on function public.increment_module_installs(uuid) from public;
grant execute on function public.increment_module_installs(uuid) to authenticated;
