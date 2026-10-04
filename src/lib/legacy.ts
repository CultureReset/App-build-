/**
 * App-build-'s own platform — its login, its Supabase project and its store
 * (module_listings, installs, page_templates) — is retired as an authority
 * (NEXT GENT plan §3, §7, §13). Accounts are Paperclip's, business data is
 * gcr-api-clean's, the store is Paperclip's. The code stays, switched off.
 *
 * APP_BUILD_LEGACY_PLATFORM=on turns all of it back on exactly as it was
 * (for migrating its data out, or reference). Anything else, or unset: off.
 * Read on the server only; the browser never decides this.
 */
export function legacyPlatformEnabled(): boolean {
  return process.env.APP_BUILD_LEGACY_PLATFORM === 'on'
}

/**
 * Paths that belong to the retired platform, and where each goes instead
 * while it is off. The builder keeps working at /build, publishing to the
 * Paperclip store; everything else explains where it went.
 */
export function retiredRedirect(pathname: string): string | null {
  if (pathname === '/dashboard/build/describe') return '/build/describe'
  if (pathname === '/dashboard/build' || pathname.startsWith('/dashboard/build/')) return '/build'
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/preview' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/u' ||
    pathname.startsWith('/u/')
  ) {
    return '/retired'
  }
  return null
}
