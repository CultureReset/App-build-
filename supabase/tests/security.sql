-- ============================================================================
-- Database security tests.
--
-- These exercise the guarantees the platform makes, against a real Postgres,
-- as the roles a real request runs under. Every check raises an exception on
-- failure, so the script exits non-zero if any guarantee stops holding.
--
-- Run with:  npm run db:test
-- ============================================================================

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

-- Two unrelated accounts.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@example.com');

update public.profiles set handle = 'alice', page_published = true
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set handle = 'mallory'
  where id = '22222222-2222-2222-2222-222222222222';

-- Alice installs a public listings block and a private one.
insert into public.installs
  (owner_id, module_id, module_version, slug, name, manifest,
   public_read_collections, public_write_collections, public_enabled)
select
  '11111111-1111-1111-1111-111111111111', 'listings', '1.0.0', 'homes', 'Homes',
  manifest, array['properties'], array[]::text[], true
from public.module_listings where module_id = 'listings';

insert into public.installs
  (owner_id, module_id, module_version, slug, name, manifest,
   public_read_collections, public_write_collections, public_enabled)
select
  '11111111-1111-1111-1111-111111111111', 'lead-capture', '1.0.0', 'leads', 'Leads',
  manifest, array[]::text[], array['enquiries'], true
from public.module_listings where module_id = 'lead-capture';

insert into public.records (install_id, owner_id, collection, data)
select id, owner_id, 'properties', '{"title":"12 Alder Street","visible":true}'::jsonb
from public.installs where slug = 'homes';

insert into public.records (install_id, owner_id, collection, data)
select id, owner_id, 'enquiries', '{"name":"A private lead","email":"x@y.com"}'::jsonb
from public.installs where slug = 'leads';

\echo '--- anonymous visitor ---'
set role anon;
select 'public listing rows visible: ' || count(*) from public.records where collection = 'properties';
select 'PRIVATE ENQUIRY ROWS VISIBLE (must be 0): ' || count(*) from public.records where collection = 'enquiries';
select 'published profiles visible: ' || count(*) from public.profiles;

\echo '--- mallory, signed in, reading alice ---'
reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'ALICE ENQUIRIES VISIBLE TO MALLORY (must be 0): ' || count(*) from public.records where collection = 'enquiries';
select 'alice installs visible (public only, expect 2): ' || count(*) from public.installs;

do $$
begin
  update public.installs set public_enabled = false;
  if found then
    raise exception 'SECURITY FAILURE: mallory modified alice''s installs';
  end if;
  raise notice 'mallory UPDATE on alice installs affected no rows';
end $$;

do $$
begin
  update public.module_listings set manifest = '{}'::jsonb where is_builtin;
  if found then
    raise exception 'SECURITY FAILURE: mallory rewrote a built-in module';
  end if;
  raise notice 'mallory UPDATE on built-in modules affected no rows';
end $$;

do $$
begin
  insert into public.module_listings (module_id, version, manifest, author_id, is_builtin, status, visibility)
  values ('evil', '1.0.0', '{}'::jsonb, '22222222-2222-2222-2222-222222222222', true, 'published', 'public');
  raise exception 'SECURITY FAILURE: mallory minted a built-in module';
exception
  when insufficient_privilege then raise notice 'mallory cannot mint a built-in module';
end $$;

do $$
begin
  insert into public.module_listings (module_id, version, manifest, author_id, is_builtin, status, visibility)
  values ('impersonation', '1.0.0', '{}'::jsonb, '11111111-1111-1111-1111-111111111111', false, 'published', 'public');
  raise exception 'SECURITY FAILURE: mallory published a module as alice';
exception
  when insufficient_privilege then raise notice 'mallory cannot author a module as alice';
end $$;

reset role;

\echo '--- anon INSERT with a REAL install id ---'
set role anon;
do $$
declare real_install uuid;
begin
  select id into real_install from public.installs where slug = 'leads';
  insert into public.records (install_id, owner_id, collection, data)
  values (real_install, '11111111-1111-1111-1111-111111111111', 'enquiries', '{"name":"forged"}'::jsonb);
  raise exception 'SECURITY FAILURE: anon inserted a record directly';
exception
  when insufficient_privilege then raise notice 'PASS: anon direct INSERT blocked by RLS';
end $$;

\echo '--- the guarded submission door ---'
do $$
declare leads uuid; forms uuid; new_id uuid;
begin
  select id into leads from public.installs where slug = 'leads';
  select id into forms from public.installs where slug = 'homes';

  new_id := public.submit_public_record(leads, 'enquiries',
    '{"name":"Real visitor","email":"v@example.com"}'::jsonb, repeat('a', 64));
  raise notice 'PASS: a legitimate submission was accepted';

  -- A collection the install never marked public-writable.
  begin
    perform public.submit_public_record(forms, 'properties',
      '{"title":"injected listing"}'::jsonb, repeat('b', 64));
    raise exception 'SECURITY FAILURE: wrote into a non-writable collection';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: write to a non-writable collection refused';
  end;

  -- Nested payloads are refused outright.
  begin
    perform public.submit_public_record(leads, 'enquiries',
      '{"name":{"nested":"object"}}'::jsonb, repeat('c', 64));
    raise exception 'SECURITY FAILURE: accepted a nested payload';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: nested payload refused';
  end;

  -- A client fingerprint that is too short to be a real hash.
  begin
    perform public.submit_public_record(leads, 'enquiries', '{"name":"x"}'::jsonb, 'short');
    raise exception 'SECURITY FAILURE: accepted a bogus client hash';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: bogus client fingerprint refused';
  end;
end $$;

\echo '--- rate limiting ---'
do $$
declare leads uuid; accepted integer := 0;
begin
  select id into leads from public.installs where slug = 'leads';

  for i in 1..12 loop
    begin
      perform public.submit_public_record(leads, 'enquiries',
        ('{"name":"flood ' || i || '"}')::jsonb, repeat('d', 64));
      accepted := accepted + 1;
    exception when sqlstate 'P0001' then
      exit;
    end;
  end loop;

  if accepted >= 12 then
    raise exception 'SECURITY FAILURE: rate limit never engaged (% accepted)', accepted;
  end if;

  raise notice 'PASS: rate limit engaged after % submissions from one client', accepted;
end $$;

\echo '--- a closed queue rejects submissions ---'
reset role;
update public.installs set accepting_submissions = false where slug = 'leads';
set role anon;
do $$
declare leads uuid;
begin
  select id into leads from public.installs where slug = 'leads';
  perform public.submit_public_record(leads, 'enquiries', '{"name":"late"}'::jsonb, repeat('e', 64));
  raise exception 'SECURITY FAILURE: a closed queue accepted a submission';
exception when sqlstate 'P0001' then
  raise notice 'PASS: closed queue refused the submission';
end $$;

\echo '--- an unpublished page hides everything ---'
reset role;
update public.profiles set page_published = false where handle = 'alice';
set role anon;
select 'rows visible on an unpublished page (must be 0): ' || count(*) from public.records;
select 'installs visible on an unpublished page (must be 0): ' || count(*) from public.installs;
reset role;
