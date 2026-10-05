import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Field, Manifest, View } from '@nextgent/app-engine'
import type { ModuleDraft } from '@/lib/modules/derive'
import type { ModuleBinding, ModuleField, PublicSurface } from '@/lib/modules/spec'
import { draftContext } from '@/lib/engine/drafts'

/**
 * One definition per app (DECISIONS #42): the engine manifests in
 * apps/<name>/manifest.json are the only definition of what ships. The builder
 * starts from them through draftFromEngineManifest(), which keeps business
 * bindings (so QR Menu stays bound to the business menu), and
 * from-module.ts takes a draft back to an engine manifest.
 *
 * shippedManifests() reads the directory, so it runs on the server (page.tsx,
 * build/page.tsx) and in tests; the browser gets the drafts as props.
 */

export interface ShippedApp {
  /** The directory under apps/, which is the app's short id (e.g. "qr-menu"). */
  dir: string
  manifest: Manifest
}

export function appsDir(cwd = process.cwd()): string {
  return path.join(cwd, 'apps')
}

export function shippedManifests(dir = appsDir()): ShippedApp[] {
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && statSync(path.join(dir, name)).isDirectory())
    .sort()
    .map((name) => ({ dir: name, manifest: JSON.parse(readFileSync(path.join(dir, name, 'manifest.json'), 'utf8')) as Manifest }))
}

/** The publishers of the shipped apps: reserved, a builder app never takes their keys (DECISIONS #43). */
export function shippedPublishers(dir = appsDir()): string[] {
  return [...new Set(shippedManifests(dir).map((s) => s.manifest.publisher))].sort()
}

/** Every shipped app, as a draft to start from. */
export function starterDrafts(dir = appsDir()): { id: string; name: string; draft: ModuleDraft }[] {
  return shippedManifests(dir).map(({ dir: id, manifest }) => ({ id, name: manifest.name, draft: draftFromEngineManifest(manifest) }))
}

/* ── engine manifest → builder draft ───────────────────────────────────── */

const SETTING_TYPE: Record<string, ModuleField['type']> = { text: 'text', number: 'number', boolean: 'boolean', select: 'select', url: 'url', secret: 'text' }

function moduleField(f: Field): ModuleField {
  const out: ModuleField = { key: f.key, label: f.label, type: f.type, required: Boolean(f.required), ownerOnly: Boolean(f.ownerOnly) }
  if (f.help) out.help = f.help
  if (f.placeholder) out.placeholder = f.placeholder
  if (f.options?.length) out.options = f.options.map((o) => ({ value: o.value, label: o.label, ...(o.icon ? { icon: o.icon } : {}) }))
  if (f.optionsFrom) out.optionsFrom = { source: f.optionsFrom.source, label: f.optionsFrom.label, ...(f.optionsFrom.value ? { value: f.optionsFrom.value } : {}) }
  if (f.min !== undefined) out.min = f.min
  if (f.max !== undefined) out.max = f.max
  if (f.maxLength !== undefined) out.maxLength = f.maxLength
  if (f.default !== undefined) out.defaultValue = f.default
  return out
}

/** The public view set as the one template + slots the builder edits (the reverse of from-module publicViews). */
function publicSurfaceOf(manifest: Manifest, title: string | undefined): PublicSurface | undefined {
  const views = manifest.ui?.views?.public ?? []
  const v: View | undefined = views.find((x) => x.type !== 'text')
  if (!v || !v.source) return undefined
  const f = (v.fields ?? {}) as Record<string, string | string[] | undefined>
  const one = (k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined)
  const style = v.style
  const base: PublicSurface = { template: 'catalog', collection: v.source }
  if (title) base.heading = title
  const variant = (allowed: string[], fallback: string) => (style && allowed.includes(style) ? style : fallback) as PublicSurface['defaultVariant']
  switch (v.type) {
    case 'list':
      if (style === 'grid' || f.image || f.meta || f.badge) {
        return { ...base, template: 'listings', defaultVariant: variant(['list', 'cards'], 'grid'), imageField: one('image'), subtitleField: one('subtitle'), priceField: one('value'), badgeField: one('badge'), linkField: one('link'), bodyField: one('body'), metaFields: Array.isArray(f.meta) ? (f.meta as string[]) : undefined }
      }
      return { ...base, template: 'catalog', defaultVariant: variant(['cards', 'grid'], 'list') }
    case 'links':
      if (style === 'icons') return { ...base, template: 'socials', defaultVariant: 'icons', linkField: one('link') }
      if (f.icon || f.emphasis) return { ...base, template: 'actions', defaultVariant: style === 'grid' ? 'grid' : style === 'inline' ? 'inline' : 'buttons', linkField: one('link') }
      return { ...base, template: 'links', defaultVariant: style === 'grid' ? 'grid' : 'list', linkField: one('link') }
    case 'images':
      return { ...base, template: 'gallery', defaultVariant: variant(['strip', 'feature'], 'grid'), imageField: one('image'), linkField: one('link') }
    case 'details':
      return { ...base, template: 'faq', defaultVariant: style === 'list' ? 'list' : 'accordion', bodyField: one('body') }
    case 'embed':
      return { ...base, template: 'embed', defaultVariant: style === 'stack' ? 'stack' : 'feature', linkField: one('link') }
    case 'feed':
      return { ...base, template: 'board', defaultVariant: style === 'cards' ? 'cards' : 'list', bodyField: one('body') }
    case 'form':
      return { ...base, template: 'form', submitCollection: v.source, defaultVariant: style === 'feature' ? 'feature' : 'stack' }
    default:
      return undefined
  }
}

function strip<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

/**
 * An engine manifest as the builder edits it. Business bindings are kept: a
 * `from: "business"` source becomes a collection with a `binding`, and the
 * manifest's permission reasons travel on the binding so the trip back
 * (from-module.ts) reproduces them.
 */
export function draftFromEngineManifest(manifest: Manifest): ModuleDraft {
  const permissions = manifest.permissions ?? []
  const bindings: Record<string, ModuleBinding> = {}
  for (const [key, b] of Object.entries(manifest.bindings ?? {})) {
    const resource = b.contract.split('.')[0]
    const read = permissions.find((p) => p.id.endsWith(':read') && resourceMatches(p.id, resource))
    const write = permissions.find((p) => p.id.endsWith(':write') && resourceMatches(p.id, resource))
    const binding: ModuleBinding = { contract: b.contract, access: b.access }
    if (b.fieldMap) binding.fieldMap = b.fieldMap
    if (b.inbox) binding.inbox = true
    if (read) binding.reason = read.reason
    if (b.access === 'read-write' && write) binding.write = strip({ reason: write.reason, optional: write.optional })
    bindings[key] = binding
  }

  const collections: ModuleDraft['collections'] = {}
  const sources = manifest.ui?.sources ?? {}
  const publicSubmit = (manifest.ui?.views?.public ?? []).find((v) => v.type === 'form')?.source
  for (const [key, s] of Object.entries(sources)) {
    const c: ModuleDraft['collections'][string] = {
      label: s.label,
      labelSingular: s.labelSingular,
      fields: s.fields.map(moduleField),
      titleField: s.title,
      sortable: Boolean(s.sortable),
    }
    if (s.subtitle) c.subtitleField = s.subtitle
    if (s.group) c.groupField = s.group
    if (s.visibleWhen) c.visibleField = s.visibleWhen
    if (s.from === 'business' && s.binding) c.binding = s.binding
    const submitLabel = (manifest.ui?.views?.public ?? []).find((v) => v.type === 'form' && v.source === key)?.submitLabel
    if (publicSubmit === key && submitLabel) c.publicWriteCta = submitLabel
    collections[key] = c
  }

  const settings: ModuleField[] = (manifest.config ?? []).map((c) => {
    const f: ModuleField = { key: c.key, label: c.label, type: SETTING_TYPE[c.type] ?? 'text', required: Boolean(c.required), ownerOnly: false }
    if (c.help) f.help = c.help
    if (c.default !== undefined && (typeof c.default === 'string' || typeof c.default === 'number' || typeof c.default === 'boolean')) f.defaultValue = c.default
    if (c.type === 'select') f.options = (c.options ?? []).map((o) => ({ value: o, label: o }))
    return f
  })

  const publicTitle = manifest.surfaces?.find((s) => s.kind === 'public')?.title
  const draft: ModuleDraft = {
    id: manifest.id.startsWith(`${manifest.publisher}-`) ? manifest.id.slice(manifest.publisher.length + 1) : manifest.id,
    version: manifest.version,
    name: manifest.name,
    tagline: manifest.summary ?? manifest.name,
    description: manifest.description ?? manifest.summary ?? manifest.name,
    icon: manifest.icon ?? '🧩',
    accent: draftContext.accent,
    category: 'operations',
    author: draftContext.author,
    pricing: { model: 'free', amountCents: 0 },
    settings,
    collections,
  }
  if (Object.keys(bindings).length) draft.bindings = bindings
  const surface = publicSurfaceOf(manifest, publicTitle)
  if (surface) draft.publicSurface = strip(surface)
  return draft
}

function resourceMatches(permissionId: string, family: string): boolean {
  // The permission's resource is the contract family's (engine CONTRACT_FAMILIES); compare through it.
  const resource = permissionId.split(':')[0]
  return resource === resourceFor(family)
}

import { CONTRACT_FAMILIES } from '@nextgent/app-engine'
function resourceFor(family: string): string | undefined {
  return (CONTRACT_FAMILIES as Record<string, string>)[family]
}
