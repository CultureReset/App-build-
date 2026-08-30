-- ============================================================================
-- Rate-limits AI app generation.
--
-- Each call spends real money against a third-party API, so an authenticated
-- account must not be able to call it without bound. This follows the same
-- shape as submit_public_record: a private log table nobody can read or write
-- directly, and a single definer function that checks the window and records
-- the call atomically.
-- ============================================================================

create table public.ai_generation_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_generation_log_user_idx on public.ai_generation_log (user_id, created_at desc);

alter table public.ai_generation_log enable row level security;
-- Deliberately no select/insert/update/delete policies: this table is reached
-- only through the function below, never directly.

create or replace function public.check_and_log_ai_generation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
  c_limit constant integer := 20;
  c_window constant interval := interval '1 hour';
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.ai_generation_log
  where user_id = auth.uid() and created_at > now() - c_window;

  if v_recent >= c_limit then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.ai_generation_log (user_id) values (auth.uid());
end;
$$;

revoke all on function public.check_and_log_ai_generation() from public;
grant execute on function public.check_and_log_ai_generation() to authenticated;
