import type { Manifest } from '@nextgent/app-engine'
import { slugify } from '@/lib/engine/from-module'

/**
 * Who publishes from the builder, and onto what (DECISIONS #43).
 *
 * The publisher prefix of a builder-made app is the operator's own key: the
 * deployment's configured one (NEXT_PUBLIC_STORE_PUBLISHER, or the panel's
 * field), else one derived from the operator's Paperclip session. The
 * publishers of the shipped apps (read from apps/*, never written here) are
 * reserved, so a builder app can never take a shipped app's store key.
 *
 * And a new version may only go onto an existing item whose stored manifest
 * has the same data model (tables and bindings): the store keeps installs
 * running, and a changed model would break them.
 */

export interface SessionLike { user?: { id?: string; email?: string | null; name?: string | null } | null } 

/** A publisher key from the signed-in operator: their name, else the local part of their email. */
export function publisherFromSession(session: SessionLike | null | undefined): string | null {
  const user = session?.user
  if (!user) return null
  const fromName = user.name ? slugify(user.name, 48) : ''
  if (fromName) return fromName
  const local = (user.email ?? '').split('@')[0]
  const fromEmail = local ? slugify(local, 48) : ''
  return fromEmail || null
}

export function publisherKey(input: { configured: string; session: SessionLike | null | undefined; reserved: readonly string[] }): { ok: true; publisher: string } | { ok: false; error: string } {
  const publisher = slugify(input.configured.trim(), 48) || publisherFromSession(input.session)
  if (!publisher) return { ok: false, error: 'No publisher: sign in to Paperclip, or set NEXT_PUBLIC_STORE_PUBLISHER.' }
  if (input.reserved.includes(publisher)) return { ok: false, error: `"${publisher}" is the shipped apps' publisher; builder apps carry the operator's own key.` }
  return { ok: true, publisher }
}

/** Two manifests keep installs compatible when their tables and bindings are the same. */
export function sameDataModel(a: Manifest, b: Manifest): boolean {
  const canon = (m: Manifest) => JSON.stringify({ tables: sorted(m.data?.tables ?? {}), bindings: sorted(m.bindings ?? {}) })
  return canon(a) === canon(b)
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((k) => [k, sorted((value as Record<string, unknown>)[k])]))
  }
  return value
}

/** One row of GET /api/store/admin/items as the panel reads it. */
export interface StoreListingItem { id: string; key: string; versions?: { version?: string; createdAt?: string; payload?: { app?: unknown } }[] }

/**
 * Whether `manifest` may be published: onto a new key, or onto an existing item
 * whose newest stored manifest has the same data model.
 */
export function checkPublishTarget(listing: StoreListingItem[] | null | undefined, manifest: Manifest): { ok: true; existing: { id: string; key: string } | null } | { ok: false; error: string } {
  if (!Array.isArray(listing)) return { ok: false, error: 'Could not read the store listing, so the app was not published.' }
  const item = listing.find((i) => i && i.key === manifest.id)
  if (!item) return { ok: true, existing: null }
  const newest = [...(item.versions ?? [])].sort((x, y) => String(y.createdAt ?? '').localeCompare(String(x.createdAt ?? '')))[0]
  const stored = newest?.payload?.app as Manifest | undefined
  if (stored && !sameDataModel(stored, manifest)) {
    return { ok: false, error: `"${manifest.id}" is already in the store with a different data model (tables or bindings). Change the app's name to publish it under its own key.` }
  }
  return { ok: true, existing: { id: item.id, key: item.key } }
}
