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
reset request.jwt.claim.sub;
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
reset request.jwt.claim.sub;
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
reset request.jwt.claim.sub;
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
reset request.jwt.claim.sub;
select 'rows visible on an unpublished page (must be 0): ' || count(*) from public.records;
select 'installs visible on an unpublished page (must be 0): ' || count(*) from public.installs;
reset role;

\echo '--- AI generation rate limiting ---'
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare accepted integer := 0;
begin
  for i in 1..25 loop
    begin
      perform public.check_and_log_ai_generation();
      accepted := accepted + 1;
    exception when sqlstate 'P0001' then
      exit;
    end;
  end loop;

  if accepted >= 25 then
    raise exception 'SECURITY FAILURE: AI generation rate limit never engaged (% accepted)', accepted;
  end if;

  raise notice 'PASS: AI generation rate limit engaged after % calls', accepted;
end $$;

reset role;
set role anon;
reset request.jwt.claim.sub;
do $$
begin
  perform public.check_and_log_ai_generation();
  raise exception 'SECURITY FAILURE: an anonymous caller was allowed to log an AI generation';
exception
  when insufficient_privilege then
    raise notice 'PASS: anonymous callers cannot call check_and_log_ai_generation';
  when sqlstate 'P0001' then
    raise notice 'PASS: anonymous callers cannot call check_and_log_ai_generation';
end $$;

do $$
begin
  insert into public.ai_generation_log (user_id) values ('11111111-1111-1111-1111-111111111111');
  raise exception 'SECURITY FAILURE: anon inserted directly into ai_generation_log';
exception
  when insufficient_privilege then raise notice 'PASS: direct INSERT into ai_generation_log blocked';
end $$;

reset role;

\echo '--- ai_credentials isolation ---'
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.ai_credentials (user_id, provider, api_key)
values ('11111111-1111-1111-1111-111111111111', 'anthropic', 'sk-alice-secret');

do $$
begin
  if exists (
    select 1 from public.ai_credentials
    where user_id = '11111111-1111-1111-1111-111111111111' and api_key = 'sk-alice-secret'
  ) then
    raise notice 'PASS: alice can read her own AI credential';
  else
    raise exception 'SECURITY FAILURE: alice cannot read her own AI credential';
  end if;
end $$;

reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
begin
  if exists (select 1 from public.ai_credentials where user_id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'SECURITY FAILURE: mallory can read alice''s AI credential';
  end if;
  raise notice 'PASS: mallory cannot see alice''s AI credential exists at all';
end $$;

do $$
begin
  update public.ai_credentials
  set api_key = 'sk-overwritten-by-mallory'
  where user_id = '11111111-1111-1111-1111-111111111111';

  if found then
    raise exception 'SECURITY FAILURE: mallory overwrote alice''s AI credential';
  end if;
  raise notice 'PASS: mallory cannot modify alice''s AI credential';
end $$;

do $$
begin
  delete from public.ai_credentials where user_id = '11111111-1111-1111-1111-111111111111';
  if found then
    raise exception 'SECURITY FAILURE: mallory deleted alice''s AI credential';
  end if;
  raise notice 'PASS: mallory cannot delete alice''s AI credential';
end $$;

reset role;
set role anon;
reset request.jwt.claim.sub;
do $$
begin
  if exists (select 1 from public.ai_credentials) then
    raise exception 'SECURITY FAILURE: an anonymous caller can read AI credentials';
  end if;
  raise notice 'PASS: anonymous callers see no AI credentials at all';
end $$;

do $$
begin
  insert into public.ai_credentials (user_id, provider, api_key)
  values ('22222222-2222-2222-2222-222222222222', 'openai', 'sk-injected');
  raise exception 'SECURITY FAILURE: an anonymous caller inserted an AI credential';
exception
  when insufficient_privilege then
    raise notice 'PASS: anonymous callers cannot insert an AI credential';
end $$;

reset role;

\echo '--- a custom provider without a base URL is rejected at the database ---'
do $$
begin
  insert into public.ai_credentials (user_id, provider, api_key)
  values ('22222222-2222-2222-2222-222222222222', 'custom', 'sk-x');
  raise exception 'SECURITY FAILURE: a custom provider was stored without a base URL';
exception
  when check_violation then
    raise notice 'PASS: a custom provider without a base URL is rejected';
end $$;
