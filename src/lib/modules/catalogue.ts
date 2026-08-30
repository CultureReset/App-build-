import type { SupabaseClient } from '@supabase/supabase-js'
import { safeParseManifest, type ModuleManifest } from '@/lib/modules/spec'
import { getBuiltinModule } from '@/lib/modules/builtins'
import type { InstallRow } from '@/lib/supabase/types'

export type ModuleListingRow = {
  id: string
  module_id: string
  version: string
  author_id: string | null
  manifest: unknown
  price_cents: number
  pricing_model: 'free' | 'one_time' | 'subscription'
  status: 'draft' | 'published' | 'delisted'
  visibility: 'private' | 'unlisted' | 'public'
  is_builtin: boolean
  install_count: number
  created_at: string
  updated_at: string
}

/** A stored module together with its parsed manifest. */
export type CatalogueEntry = { listing: ModuleListingRow; manifest: ModuleManifest }

/**
 * Parses stored rows, dropping any whose manifest no longer satisfies the spec.
 *
 * A single bad row must never take down the store or someone's dashboard, so
 * invalid entries are skipped rather than thrown.
 */
function parseRows(rows: ModuleListingRow[] | null): CatalogueEntry[] {
  const entries: CatalogueEntry[] = []

  for (const listing of rows ?? []) {
    const result = safeParseManifest(listing.manifest)

    if (result.success) {
      entries.push({ listing, manifest: result.data })
    }
  }

  return entries
}

/** Only the newest version of each module id, so the store shows one card each. */
function newestPerModule(entries: CatalogueEntry[]): CatalogueEntry[] {
  const seen = new Set<string>()

  return entries.filter((entry) => {
    if (seen.has(entry.listing.module_id)) {
      return false
    }

    seen.add(entry.listing.module_id)
    return true
  })
}

/** The public store. Row Level Security also enforces this filter. */
export async function listStoreModules(supabase: SupabaseClient): Promise<CatalogueEntry[]> {
  const { data } = await supabase
    .from('module_listings')
    .select('*')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('install_count', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<ModuleListingRow[]>()

  return newestPerModule(parseRows(data))
}

/** Everything the caller authored, drafts included. */
export async function listAuthoredModules(
  supabase: SupabaseClient,
  authorId: string,
): Promise<CatalogueEntry[]> {
  const { data } = await supabase
    .from('module_listings')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .returns<ModuleListingRow[]>()

  return parseRows(data)
}

export async function loadListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<CatalogueEntry | null> {
  const { data } = await supabase
    .from('module_listings')
    .select('*')
    .eq('id', listingId)
    .maybeSingle<ModuleListingRow>()

  return data ? (parseRows([data])[0] ?? null) : null
}

/**
 * Resolves a module id to its newest readable version. Used when a layout names
 * a module by id rather than pinning a specific listing.
 */
export async function loadNewestByModuleId(
  supabase: SupabaseClient,
  moduleId: string,
): Promise<CatalogueEntry | null> {
  const { data } = await supabase
    .from('module_listings')
    .select('*')
    .eq('module_id', moduleId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<ModuleListingRow[]>()

  return parseRows(data)[0] ?? null
}

/**
 * The manifest an installed app actually runs on.
 *
 * Installs pin the manifest they were installed with, so an author editing or
 * deleting their module can never change or break an app already running on
 * someone else's account. The fallback covers installs created before pinning
 * existed.
 */
export function installManifest(install: InstallRow): ModuleManifest | null {
  if (install.manifest) {
    const result = safeParseManifest(install.manifest)

    if (result.success) {
      return result.data
    }
  }

  return getBuiltinModule(install.module_id) ?? null
}
