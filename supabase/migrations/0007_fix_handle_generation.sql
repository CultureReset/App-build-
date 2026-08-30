-- ============================================================================
-- Fixes automatic handle generation.
--
-- The original version built the handle as `candidate || nullif(suffix, 0)`,
-- which is NULL whenever suffix is 0 — that is, for every first attempt. The
-- profile insert then failed its NOT NULL constraint and no account could ever
-- be created.
--
-- 0001 carries the corrected function for fresh databases; this migration
-- applies the same fix to any database already created from the old one.
-- ============================================================================

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
