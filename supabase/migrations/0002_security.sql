-- ============================================================================
-- Row Level Security
--
-- Nothing below trusts application code. Every table denies by default and then
-- grants the narrowest workable policy. If a page, an action, or a future
-- user-built module has a bug, these policies are what still holds.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.installs enable row level security;
alter table public.records enable row level security;
alter table public.module_listings enable row level security;
alter table public.public_submission_log enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "own profile is readable"
  on public.profiles for select
  using (auth.uid() = id);

-- A published page exposes only what a visitor needs to render it.
create policy "published profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (page_published = true);

create policy "own profile is writable"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- installs
-- ---------------------------------------------------------------------------
create policy "owners manage their installs"
  on public.installs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- A visitor may see an install only when the owner published the page *and*
-- switched that specific container on. Both flags, every time.
create policy "published installs are publicly readable"
  on public.installs for select
  to anon, authenticated
  using (
    public_enabled = true
    and enabled = true
    and exists (
      select 1 from public.profiles p
      where p.id = installs.owner_id and p.page_published = true
    )
  );

-- ---------------------------------------------------------------------------
-- records
-- ---------------------------------------------------------------------------
create policy "owners manage their records"
  on public.records for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Anonymous reads are gated on the collection appearing in the install's
-- stored public_read_collections list — which is derived from a validated
-- manifest at install time, never from anything a request supplies.
create policy "public collections are readable"
  on public.records for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.installs i
      join public.profiles p on p.id = i.owner_id
      where i.id = records.install_id
        and i.enabled = true
        and i.public_enabled = true
        and p.page_published = true
        and records.collection = any (i.public_read_collections)
    )
  );

-- Note the absence of any anon INSERT/UPDATE/DELETE policy on records.
-- Visitor submissions go exclusively through submit_public_record() below.

-- ---------------------------------------------------------------------------
-- module_listings
-- ---------------------------------------------------------------------------
create policy "published listings are readable"
  on public.module_listings for select
  to anon, authenticated
  using (status = 'published');

create policy "authors manage their own listings"
  on public.module_listings for all
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- public_submission_log stays entirely private; only the definer function
-- below ever touches it.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- submit_public_record: the single, guarded door for anonymous writes
--
-- Checks, in order: the install is live and accepting; the target collection is
-- explicitly public-writable; the payload is a flat JSON object of bounded
-- size; and this client has not exceeded the window. Only then does it insert.
-- ============================================================================
create or replace function public.submit_public_record(
  p_install_id uuid,
  p_collection text,
  p_payload jsonb,
  p_client_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_install public.installs%rowtype;
  v_recent integer;
  v_key text;
  v_id uuid;
  -- Per-client allowance, and a ceiling for the whole install.
  c_client_limit constant integer := 5;
  c_install_limit constant integer := 240;
  c_window constant interval := interval '10 minutes';
begin
  select * into v_install
  from public.installs
  where id = p_install_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if not (v_install.enabled and v_install.public_enabled and v_install.accepting_submissions) then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_install.owner_id and page_published = true
  ) then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  if not (p_collection = any (v_install.public_write_collections)) then
    raise exception 'forbidden_collection' using errcode = 'P0001';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  if pg_column_size(p_payload) > 8192 then
    raise exception 'payload_too_large' using errcode = 'P0001';
  end if;

  -- Reject nested structures outright: module fields are scalars, so anything
  -- deeper is either a broken client or someone probing.
  for v_key in select jsonb_object_keys(p_payload) loop
    if jsonb_typeof(p_payload -> v_key) not in ('string', 'number', 'boolean', 'null') then
      raise exception 'invalid_payload' using errcode = 'P0001';
    end if;
  end loop;

  if char_length(coalesce(p_client_hash, '')) < 16 then
    raise exception 'invalid_client' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.public_submission_log
  where install_id = p_install_id
    and client_hash = p_client_hash
    and created_at > now() - c_window;

  if v_recent >= c_client_limit then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.public_submission_log
  where install_id = p_install_id
    and created_at > now() - c_window;

  if v_recent >= c_install_limit then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.records (install_id, owner_id, collection, data, submitted_by_public)
  values (p_install_id, v_install.owner_id, p_collection, p_payload, true)
  returning id into v_id;

  insert into public.public_submission_log (install_id, client_hash)
  values (p_install_id, p_client_hash);

  return v_id;
end;
$$;

revoke all on function public.submit_public_record(uuid, text, jsonb, text) from public;
grant execute on function public.submit_public_record(uuid, text, jsonb, text) to anon, authenticated;
