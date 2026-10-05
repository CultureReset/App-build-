// retired: definitions live in apps/*/manifest.json
// Frozen: the builder, the home page and the tests start from apps/ through
// src/lib/engine/starters.ts (DECISIONS #42). Only the retired platform
// (APP_BUILD_LEGACY_PLATFORM=on) still reads this: catalogue.ts, demo/page.ts,
// scripts/generate-module-seed.ts.
import { parseManifest, type ModuleManifest } from '@/lib/modules/spec'
import qrMenu from '@/modules/qr-menu/manifest'
import songRequest from '@/modules/song-request/manifest'
import linkHub from '@/modules/link-hub/manifest'
import listings from '@/modules/listings/manifest'
import actionButtons from '@/modules/action-buttons/manifest'
import socialLinks from '@/modules/social-links/manifest'
import leadCapture from '@/modules/lead-capture/manifest'
import gallery from '@/modules/gallery/manifest'
import faq from '@/modules/faq/manifest'
import video from '@/modules/video/manifest'

/**
 * The apps that ship with the platform.
 *
 * These are *seed data*, not a registry. They are written into the
 * `module_listings` table by a migration and from then on are ordinary rows
 * with no privileges beyond an author-less "builtin" badge — the store reads
 * them from the database exactly as it reads a module a user built.
 *
 * The seed SQL is generated from this file by `npm run seed:modules`, so these
 * manifests stay the single source of truth for what ships.
 */
const sources: unknown[] = [
  listings,
  actionButtons,
  socialLinks,
  leadCapture,
  gallery,
  video,
  faq,
  linkHub,
  qrMenu,
  songRequest,
]

export const BUILTIN_MODULES: ModuleManifest[] = sources.map((source, index) => {
  const manifest = parseManifest(source)

  const duplicate = sources.findIndex(
    (other, otherIndex) => otherIndex < index && (other as ModuleManifest).id === manifest.id,
  )

  if (duplicate !== -1) {
    throw new Error(`Duplicate builtin module id "${manifest.id}".`)
  }

  return manifest
})

export function getBuiltinModule(id: string): ModuleManifest | undefined {
  return BUILTIN_MODULES.find((manifest) => manifest.id === id)
}
