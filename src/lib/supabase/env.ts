import { legacyPlatformEnabled } from '@/lib/legacy'

/**
 * Supabase credentials are read through here so that a missing environment
 * variable fails with an explanation instead of an opaque runtime error.
 */
export function supabaseEnv() {
  // On the server the retired platform's switch decides; a browser client
  // only exists inside pages the server let through.
  if (typeof window === 'undefined' && !legacyPlatformEnabled()) {
    throw new Error(
      "App-build-'s own Supabase is switched off (APP_BUILD_LEGACY_PLATFORM is not 'on'). Data goes through gcr-api-clean.",
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return legacyPlatformEnabled() && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
}
