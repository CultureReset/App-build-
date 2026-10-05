import { resourceForContract, type Field, type Manifest, type View } from '@nextgent/app-engine'
import type { ModuleBinding, ModuleField, ModuleManifest, PublicSurface } from '@/lib/modules/spec'

/**
 * App-build-'s module manifest (src/lib/modules/spec.ts, what the builder and
 * describe-it produce) → the engine manifest (app-manifest v1 + ui) that the
 * Paperclip store publishes and every screen renders.
 *
 * It carries over what the old runtime did by convention, so a converted app
 * behaves as it did: a boolean field keyed `visible` or `available` hides a
 * row publicly (templates/shared.tsx), a `currency` setting formats money and
 * `footer_note` / `intro` / `accepting` settings feed the catalog and form
 * blocks (Catalog.tsx, FormBlock.tsx). Prices are not carried: the store sets
 * them (PUT /api/store/admin/items/:id/price).
 *
 * A collection with a `binding` is business data (DECISIONS #45): it becomes a
 * `from: "business"` source resolved through the manifest's `bindings`, has no
 * table of its own, and the permissions its contract implies are derived here
 * — `<resource>:read`, plus `<resource>:write` for read-write — with the
 * binding's reasons. An author never types a permission.
 */

const ORDER_COLUMN = 'sort_order'

const COLUMN: Record<ModuleField['type'], string> = {
  text: 'text', longtext: 'text', select: 'text', email: 'text', phone: 'text', url: 'text',
  image: 'text', color: 'text', time: 'text', number: 'number', money: 'money', boolean: 'boolean', date: 'date',
}

const CONFIG: Record<ModuleField['type'], 'text' | 'number' | 'boolean' | 'select' | 'url'> = {
  text: 'text', longtext: 'text', email: 'text', phone: 'text', color: 'text', date: 'text', time: 'text',
  image: 'url', url: 'url', number: 'number', money: 'number', boolean: 'boolean', select: 'select',
}

export function slugify(input: string, max = 40): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max)
}

/** A store item key: publisher-prefixed, as app-manifest v1 and Paperclip both require. */
export function engineId(publisher: string, name: string): string {
  return `${slugify(publisher, 40)}-${slugify(name, 48) || 'app'}`.slice(0, 80).replace(/-+$/, '')
}

function field(f: ModuleField): Field {
  const out: Field = { key: f.key, label: f.label, type: f.type }
  if (f.required) out.required = true
  if (f.help) out.help = f.help
  if (f.placeholder) out.placeholder = f.placeholder
  if (f.options?.length) out.options = f.options.map((o) => ({ value: o.value, label: o.label, ...(o.icon ? { icon: o.icon } : {}) }))
  if (f.optionsFrom) out.optionsFrom = { source: f.optionsFrom.source, label: f.optionsFrom.label, ...(f.optionsFrom.value ? { value: f.optionsFrom.value } : {}) }
  if (f.min !== undefined) out.min = f.min
  if (f.max !== undefined) out.max = f.max
  if (f.maxLength !== undefined) out.maxLength = f.maxLength
  if (f.defaultValue !== undefined) out.default = f.defaultValue
  if (f.ownerOnly) out.ownerOnly = true
  return out
}

function visibilityFlag(fields: ModuleField[]): string | undefined {
  return fields.find((f) => f.type === 'boolean' && (f.key === 'visible' || f.key === 'available'))?.key
}

/** The reason wording used when a binding gives none. */
export const BINDING_REASONS = {
  read: (contract: string) => `Reads the business's ${contract.replace('.', ' ')} to show them.`,
  write: (contract: string) => `Edits the business's ${contract.replace('.', ' ')} from inside this app.`,
}

/**
 * Permissions implied by the draft's bindings, in binding order: read, then
 * write for read-write, one entry per resource (the first binding's reasons win).
 */
export function permissionsFromBindings(bindings: Record<string, ModuleBinding> | undefined): NonNullable<Manifest['permissions']> {
  const out: NonNullable<Manifest['permissions']> = []
  const seen = new Set<string>()
  for (const b of Object.values(bindings ?? {})) {
    const resource = resourceForContract(b.contract)
    if (!resource) continue
    const read = `${resource}:read`
    if (!seen.has(read)) {
      seen.add(read)
      out.push({ id: read, reason: b.reason ?? BINDING_REASONS.read(b.contract) })
    }
    if (b.access === 'read-write') {
      const write = `${resource}:write`
      if (!seen.has(write)) {
        seen.add(write)
        const perm: NonNullable<Manifest['permissions']>[number] = { id: write, reason: b.write?.reason ?? BINDING_REASONS.write(b.contract) }
        if (b.write?.optional) perm.optional = true
        out.push(perm)
      }
    }
  }
  return out
}

function hasSetting(m: ModuleManifest, key: string, type?: ModuleField['type']) {
  return m.settings.some((s) => s.key === key && (!type || s.type === type))
}

function publicViews(m: ModuleManifest, s: PublicSurface): View[] {
  const c = m.collections[s.collection]
  const keys = c.fields.map((f) => f.key)
  const has = (k?: string) => (k && keys.includes(k) ? k : undefined)
  const variant = s.defaultVariant
  const heading = s.heading
  const pick = (o: Record<string, string | string[] | undefined>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))) as Record<string, string | string[]>
  const linkKey = has(s.linkField) ?? has(c.subtitleField)

  switch (s.template) {
    case 'catalog': {
      const views: View[] = [{ type: 'list', source: s.collection, heading, style: variant === 'cards' || variant === 'grid' ? variant : 'list', fields: pick({ title: c.titleField, value: has(c.subtitleField), body: has('description') }) }]
      if (hasSetting(m, 'footer_note')) views.push({ type: 'text', text: { setting: 'footer_note' }, heading: '' })
      return views
    }
    case 'listings':
      return [{ type: 'list', source: s.collection, heading, style: variant === 'list' || variant === 'cards' ? variant : 'grid', fields: pick({
        title: c.titleField, subtitle: has(s.subtitleField), image: has(s.imageField), value: has(s.priceField), badge: has(s.badgeField),
        link: has(s.linkField), body: has(s.bodyField), meta: (s.metaFields ?? []).filter((k) => keys.includes(k)),
      }) }]
    case 'form': {
      const view: View = { type: 'form', source: s.submitCollection ?? s.collection, heading, style: variant === 'feature' ? 'feature' : 'stack' }
      const target = m.collections[s.submitCollection ?? s.collection]
      if (target.publicWriteCta) view.submitLabel = target.publicWriteCta
      if (hasSetting(m, 'intro')) view.intro = { setting: 'intro' }
      if (hasSetting(m, 'accepting', 'boolean')) view.openWhen = { setting: 'accepting' }
      return [view]
    }
    case 'links':
      return [{ type: 'links', source: s.collection, heading, style: variant === 'grid' ? 'grid' : 'stack', fields: pick({ label: c.titleField, link: linkKey, note: has('description') }) }]
    case 'actions': {
      const icon = c.fields.find((f) => f.key === 'icon' && f.type === 'select')?.key
      const emphasis = c.fields.find((f) => f.key === 'style' && f.type === 'select')?.key
      return [{ type: 'links', source: s.collection, heading, style: variant === 'grid' ? 'grid' : variant === 'inline' ? 'inline' : 'stack', fields: pick({ label: c.titleField, link: linkKey, icon, emphasis }) }]
    }
    case 'socials': {
      const title = c.fields.find((f) => f.key === c.titleField)
      return [{ type: 'links', source: s.collection, heading, style: variant === 'icons' ? 'icons' : 'inline', fields: pick({ label: c.titleField, link: linkKey, icon: title?.type === 'select' ? title.key : undefined }) }]
    }
    case 'gallery':
      return [{ type: 'images', source: s.collection, heading, style: variant === 'strip' || variant === 'feature' ? variant : 'grid', fields: pick({ image: has(s.imageField), caption: c.titleField, link: has(s.linkField) }) }]
    case 'faq':
      return [{ type: 'details', source: s.collection, heading, style: variant === 'list' ? 'list' : 'accordion', fields: pick({ summary: c.titleField, body: has(s.bodyField) }) }]
    case 'embed':
      return [{ type: 'embed', source: s.collection, heading, style: variant === 'stack' ? 'stack' : 'feature', fields: pick({ link: has(s.linkField), title: c.titleField }) }]
    case 'board':
      return [{ type: 'feed', source: s.collection, heading, style: variant === 'cards' ? 'cards' : 'list', fields: pick({ title: c.titleField, subtitle: has(c.subtitleField), body: has(s.bodyField) }) }]
  }
}

/**
 * @param m        a module manifest that already passed src/lib/modules/spec.ts
 * @param identity publisher (store publisher id) and optionally the id to use
 */
export function engineManifestFromModule(m: ModuleManifest, identity: { publisher: string; id?: string }): Manifest {
  const id = identity.id ?? engineId(identity.publisher, m.name)
  const surface = m.publicSurface

  const tables: NonNullable<Manifest['data']>['tables'] = {}
  const sources: NonNullable<Manifest['ui']>['sources'] = {}
  const bindings: NonNullable<Manifest['bindings']> = {}
  for (const [key, b] of Object.entries(m.bindings ?? {})) {
    bindings[key] = { contract: b.contract as NonNullable<Manifest['bindings']>[string]['contract'], access: b.access, ...(b.fieldMap ? { fieldMap: b.fieldMap } : {}) }
  }
  for (const [key, c] of Object.entries(m.collections)) {
    let source: NonNullable<Manifest['ui']>['sources'][string]
    if (c.binding) {
      // Business data: no table; the binding's contract says where the rows live.
      source = { from: 'business', binding: c.binding, label: c.label, labelSingular: c.labelSingular, fields: c.fields.map(field), title: c.titleField }
    } else {
      const columns: Record<string, { type: string; required?: boolean; default?: string | number | boolean; max_length?: number }> = {}
      for (const f of c.fields) {
        const col: (typeof columns)[string] = { type: COLUMN[f.type] }
        if (f.required) col.required = true
        if (f.defaultValue !== undefined) col.default = f.defaultValue
        if (f.maxLength !== undefined && COLUMN[f.type] === 'text') col.max_length = f.maxLength
        columns[f.key] = col
      }
      if (c.sortable && !columns[ORDER_COLUMN]) columns[ORDER_COLUMN] = { type: 'integer' }
      const access = c.publicRead && c.publicWrite ? 'read-append' : c.publicRead ? 'read' : c.publicWrite ? 'append' : 'none'
      tables[key] = { columns, public: access }
      source = { from: 'app', table: key, label: c.label, labelSingular: c.labelSingular, fields: c.fields.map(field), title: c.titleField }
    }
    if (c.subtitleField) source.subtitle = c.subtitleField
    if (c.groupField) source.group = c.groupField
    if (c.sortable) {
      source.sortable = true
      source.order = ORDER_COLUMN
    }
    const flag = c.visibleField ?? visibilityFlag(c.fields)
    if (flag) source.visibleWhen = flag
    sources[key] = source
  }

  const owner: View[] = Object.keys(m.collections).map((key) => ({ type: 'collection', source: key }))
  if (m.settings.length) owner.push({ type: 'settings' })
  const views: NonNullable<Manifest['ui']>['views'] = { owner }
  const surfaces: NonNullable<Manifest['surfaces']> = [{ id: 'owner', kind: 'dashboard', title: m.name, path: '/owner', display_modes: ['page'] }]
  if (surface) {
    views.public = publicViews(m, surface)
    surfaces.push({ id: 'public', kind: 'public', title: surface.heading ?? m.name, path: '/public', display_modes: ['inline', 'card', 'page'] })
  }

  const out: Manifest = {
    schema_version: 1,
    id,
    name: m.name,
    summary: m.tagline,
    description: m.description,
    version: m.version,
    publisher: slugify(identity.publisher, 48),
    icon: m.icon,
    requires: { platform: '1' },
    runtime: { type: 'engine', engine: '1' },
    surfaces,
    permissions: permissionsFromBindings(m.bindings),
    ...(Object.keys(tables).length ? { data: { namespace: id.replace(/-/g, '_').slice(0, 40), tables } } : {}),
    ...(Object.keys(bindings).length ? { bindings } : {}),
    config: m.settings.map((s) => {
      const c: NonNullable<Manifest['config']>[number] = { key: s.key, label: s.label, type: CONFIG[s.type] }
      if (s.required) c.required = true
      if (s.defaultValue !== undefined) c.default = s.defaultValue
      if (s.type === 'select') c.options = (s.options ?? []).map((o) => o.value)
      if (s.help) c.help = s.help
      return c
    }),
    ui: { sources, views },
  }
  if (m.pricing.model === 'free') out.pricing = { model: 'free' }
  // Currency: the business's own when a binding reads business.currency; else the install setting.
  const currencyBinding = Object.entries(m.bindings ?? {}).find(([, b]) => b.contract === 'business.currency')?.[0]
  if (currencyBinding) out.ui!.format = { currency: { binding: currencyBinding } }
  else if (hasSetting(m, 'currency')) out.ui!.format = { currency: { setting: 'currency' } }
  return out
}
