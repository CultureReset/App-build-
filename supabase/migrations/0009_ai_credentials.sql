-- ============================================================================
-- Per-account AI provider credentials — "bring your own key, any provider."
--
-- Every account can point app generation at whatever provider they choose,
-- independent of anyone else's configuration, including the platform
-- operator's own default (set via environment variables, checked only when an
-- account has not configured their own).
-- ============================================================================

create table public.ai_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'google', 'openrouter', 'custom')),
  api_key text check (api_key is null or char_length(api_key) <= 400),
  -- Only meaningful for, and required by, the "custom" provider.
  base_url text check (base_url is null or (base_url ~ '^https?://' and char_length(base_url) <= 300)),
  constraint ai_credentials_custom_needs_url
    check (provider <> 'custom' or base_url is not null),
  model text check (model is null or char_length(model) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;

create policy "owners manage their own AI credential"
  on public.ai_credentials for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger ai_credentials_touch before update on public.ai_credentials
  for each row execute function public.touch_updated_at();
