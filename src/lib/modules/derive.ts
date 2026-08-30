import {
  parseManifest,
  safeParseManifest,
  type ModuleCollection,
  type ModuleManifest,
  sortPermissions,
  type ModulePermission,
} from '@/lib/modules/spec'

/**
 * What the app builder edits: a manifest without the parts that should never be
 * hand-set. Public read/write flags and the permission list are *derived* from
 * what the module actually does, so an author cannot claim less access than
 * their app takes, or accidentally expose a collection they meant to keep
 * private.
 */
export type ModuleDraft = Omit<ModuleManifest, 'permissions' | 'collections'> & {
  collections: Record<string, Omit<ModuleCollection, 'publicRead' | 'publicWrite'>>
}

/** Fills in the derived fields and returns something the spec will accept. */
export function deriveManifest(draft: ModuleDraft): unknown {
  const surface = draft.publicSurface

  const collections: Record<string, ModuleCollection> = {}

  for (const [key, collection] of Object.entries(draft.collections)) {
    collections[key] = {
      ...collection,
      // A form's collection is written to, never read from, by visitors.
      publicRead: Boolean(surface) && surface!.collection === key && surface!.template !== 'form',
      publicWrite: Boolean(surface?.submitCollection) && surface!.submitCollection === key,
    }
  }

  const permissions: ModulePermission[] = ['store_records']

  if (surface) {
    permissions.push('public_page', 'generate_qr')
  }

  if (Object.values(collections).some((collection) => collection.publicWrite)) {
    permissions.push('collect_submissions')
  }

  return { ...draft, collections, permissions: sortPermissions(permissions) }
}

export function validateDraft(draft: ModuleDraft) {
  return safeParseManifest(deriveManifest(draft))
}

export function manifestFromDraft(draft: ModuleDraft): ModuleManifest {
  return parseManifest(deriveManifest(draft))
}

/** Turns a stored manifest back into something the builder can edit. */
export function draftFromManifest(manifest: ModuleManifest): ModuleDraft {
  const collections: ModuleDraft['collections'] = {}

  for (const [key, collection] of Object.entries(manifest.collections)) {
    const { publicRead: _read, publicWrite: _write, ...rest } = collection
    collections[key] = rest
  }

  const { permissions: _permissions, collections: _collections, ...rest } = manifest

  return { ...rest, collections }
}

/** Bumps the patch component, or the minor when asked. */
export function nextVersion(version: string, part: 'patch' | 'minor' | 'major' = 'patch'): string {
  const [major, minor, patch] = version.split('.').map(Number)

  if (part === 'major') return `${major + 1}.0.0`
  if (part === 'minor') return `${major}.${minor + 1}.0`

  return `${major}.${minor}.${patch + 1}`
}
