import { parseManifest, type ModuleManifest } from '@/lib/modules/spec'
import qrMenu from '@/modules/qr-menu/manifest'
import songRequest from '@/modules/song-request/manifest'
import linkHub from '@/modules/link-hub/manifest'

/**
 * The catalogue of modules this deployment knows about.
 *
 * Every manifest is validated at module-load time, so a malformed module fails
 * loudly at boot rather than halfway through somebody's dashboard. User-built
 * and store-bought modules will be loaded from the database through the exact
 * same `parseManifest` gate.
 */
const sources: unknown[] = [qrMenu, songRequest, linkHub]

const catalogue: ModuleManifest[] = sources.map((source, index) => {
  const result = parseManifest(source)
  const duplicate = sources.findIndex(
    (other, otherIndex) =>
      otherIndex < index && (other as ModuleManifest).id === result.id,
  )

  if (duplicate !== -1) {
    throw new Error(`Duplicate module id "${result.id}" in the registry.`)
  }

  return result
})

const byId = new Map(catalogue.map((manifest) => [manifest.id, manifest]))

export function listModules(): ModuleManifest[] {
  return catalogue
}

export function getModule(id: string): ModuleManifest | undefined {
  return byId.get(id)
}

/** Throws when the id is unknown — use where a missing module is a bug, not a 404. */
export function requireModule(id: string): ModuleManifest {
  const manifest = byId.get(id)

  if (!manifest) {
    throw new Error(`Unknown module "${id}".`)
  }

  return manifest
}
