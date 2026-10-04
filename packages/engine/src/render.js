// The two renderers. Each takes (manifest, settings, data, actions) and
// returns blocks (blocks.js). They are pure: no network, no clock unless
// given one, no knowledge of any particular app. Everything they show comes
// from the manifest's ui section and the rows the data adapter loaded.
//
//   renderOwner   the owner's screen: every surface of kind dashboard/settings
//   renderPublic  the public block: every surface of kind public
//   renderSurface any one surface by id (a TV card, a widget)
//
// `data`    { [sourceKey]: row[] } — rows as gcr-api-clean returns them.
// `actions` what the viewer may do and where the screen is:
//             granted   permissions the install holds (default: all declared)
//             settings  false to hide the settings form's save
//             editing   { source, id } — a row's form is open (id null = new)
//             values    { [formId]: values } — what the form currently holds
//             errors    { [formId]: { field: message, _form?: message } }
//             submitted { [formId]: true } — a visitor form went through
// `options` copy, locale, currency, now, embeds (see README)

import { checkValues, blankValues, safeHref, safeImage, settingsFields, settingsWithDefaults } from './values.js'
import { formatValue, optionList, relativeTime, resolveFormat } from './format.js'
import { copyWith, fill } from './copy.js'

const OWNER_KINDS = ['dashboard', 'settings']
const PUBLIC_KINDS = ['public']
const BUTTON_STYLES = ['primary', 'secondary', 'danger', 'ghost']

function context(manifest, settings, data, actions = {}, options = {}) {
  const sources = manifest?.ui?.sources || {}
  const declared = (manifest?.permissions || []).map((p) => p.id)
  const granted = new Set(Array.isArray(actions.granted) ? actions.granted : declared)
  const resolvedSettings = settingsWithDefaults(manifest, settings)
  const copy = copyWith(options.copy)
  const format = resolveFormat(manifest, resolvedSettings, options)
  const lookupsBySource = {}
  for (const [key, source] of Object.entries(sources)) {
    const lookups = {}
    for (const f of source.fields || []) {
      if (!f.optionsFrom) continue
      const rows = Array.isArray(data?.[f.optionsFrom.source]) ? data[f.optionsFrom.source] : []
      const valueKey = f.optionsFrom.value || 'id'
      lookups[f.key] = rows
        .filter((r) => r && r[valueKey] !== undefined && r[valueKey] !== null)
        .map((r) => ({ value: r[valueKey], label: String(r[f.optionsFrom.label] ?? r[valueKey]) }))
    }
    lookupsBySource[key] = lookups
  }
  return {
    manifest, sources, granted, settings: resolvedSettings, data: data || {}, actions, options, copy,
    format, lookupsBySource, now: options.now ?? Date.now(),
  }
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function rowsOf(ctx, key) {
  const rows = ctx.data[key]
  return Array.isArray(rows) ? rows.filter((r) => r && typeof r === 'object') : []
}

function fieldOf(source, key) {
  return (source.fields || []).find((f) => f.key === key)
}

function display(ctx, sourceKey, field, row) {
  // Owner-only fields are never drawn for a visitor, whichever slot (bound or
  // defaulted from the source's title) led here.
  if (!field || (ctx.visitor && field.ownerOnly)) return ''
  return formatValue(field, row[field.key], { ...ctx.format, copy: ctx.copy, lookups: ctx.lookupsBySource[sourceKey] })
}

function rowId(row, index) {
  return row.id !== undefined && row.id !== null ? String(row.id) : `row-${index}`
}

function ordered(source, rows) {
  if (!source.order) return rows
  return [...rows].sort((a, b) => (Number(a[source.order]) || 0) - (Number(b[source.order]) || 0))
}

function newestFirst(rows) {
  return [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
}

/** Rows with the source's visibility flag off never reach a visitor. */
function visible(source, rows) {
  if (!source.visibleWhen) return rows
  return rows.filter((r) => r[source.visibleWhen] !== false && r[source.visibleWhen] !== 'false')
}

/** Split rows into the group field's options, in option order; leftovers last. */
function grouped(ctx, sourceKey, source, rows) {
  const field = source.group ? fieldOf(source, source.group) : null
  if (!field) return [{ key: '', label: '', rows }]
  const options = optionList(field, ctx.lookupsBySource[sourceKey])
  const groups = options
    .map((o) => ({ key: String(o.value), label: o.label, rows: rows.filter((r) => String(r[field.key]) === String(o.value)) }))
    .filter((g) => g.rows.length)
  const known = new Set(options.map((o) => String(o.value)))
  const rest = rows.filter((r) => !known.has(String(r[field.key])))
  if (rest.length) groups.push({ key: '__other', label: groups.length ? ctx.copy.other : '', rows: rest })
  return groups
}

function settingText(ctx, ref) {
  if (typeof ref === 'string') return ref
  if (ref && typeof ref === 'object' && ref.setting) {
    const v = ctx.settings[ref.setting]
    return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)
  }
  return ''
}

/** What this viewer may do to a source's rows. */
function abilities(ctx, source) {
  if (source.from === 'app') return { read: true, write: true }
  return {
    read: ctx.granted.has(`${source.resource}:read`),
    write: ctx.granted.has(`${source.resource}:write`),
  }
}

function formFields(source, { visitor }, lookups) {
  return (source.fields || [])
    .filter((f) => !f.readOnly && !(visitor && f.ownerOnly))
    .map((f) => {
      const out = { key: f.key, label: f.label, type: f.type, required: Boolean(f.required) }
      for (const k of ['help', 'placeholder', 'min', 'max', 'maxLength']) if (f[k] !== undefined) out[k] = f[k]
      if (f.type === 'select') out.options = optionList(f, lookups).map((o) => ({ value: String(o.value), label: o.label }))
      return out
    })
}

function section(title, blocks) {
  const out = { type: 'section', blocks }
  if (title) out.title = title
  return out
}

/* ── owner views ────────────────────────────────────────────────────────── */

function collectionView(ctx, view) {
  const source = ctx.sources[view.source]
  const can = abilities(ctx, source)
  const title = view.heading || source.label
  if (!can.read) return section(title, [{ type: 'notice', tone: 'warning', text: fill(ctx.copy.noAccess, { resource: source.resource }) }])

  const lookups = ctx.lookupsBySource[view.source]
  const rows = ordered(source, rowsOf(ctx, view.source))
  const editing = ctx.actions.editing && ctx.actions.editing.source === view.source ? ctx.actions.editing : null
  const blocks = [{ type: 'text', tone: 'muted', text: rows.length === 1 ? ctx.copy.countOne : fill(ctx.copy.count, { n: rows.length }) }]

  if (!can.write && source.from === 'business') blocks.push({ type: 'notice', tone: 'muted', text: ctx.copy.readOnly })

  if (can.write && !editing) {
    blocks.push({ type: 'button', label: fill(ctx.copy.add, { item: source.labelSingular.toLowerCase() }), style: 'primary', action: { type: 'view.new', source: view.source } })
  }

  if (can.write && editing) {
    const existing = editing.id === null || editing.id === undefined ? null : rows.find((r, i) => rowId(r, i) === String(editing.id))
    const formId = `${view.source}:${existing ? rowId(existing, 0) : 'new'}`
    const values = ctx.actions.values?.[formId] ?? (existing ? pick(existing, source.fields) : blankValues(source.fields))
    blocks.push({
      type: 'form',
      id: formId,
      fields: formFields(source, { visitor: false }, lookups),
      values,
      errors: ctx.actions.errors?.[formId] || {},
      submit: {
        label: existing ? ctx.copy.save : fill(ctx.copy.add, { item: source.labelSingular.toLowerCase() }),
        action: existing ? { type: 'record.update', source: view.source, id: rowId(existing, 0) } : { type: 'record.create', source: view.source },
      },
      cancel: { label: ctx.copy.cancel, style: 'secondary', action: { type: 'view.cancel', source: view.source } },
    })
  }

  const titleField = fieldOf(source, source.title)
  const subtitleField = source.subtitle ? fieldOf(source, source.subtitle) : null
  const columns = [{ key: titleField.key, label: titleField.label }]
  if (subtitleField) columns.push({ key: subtitleField.key, label: subtitleField.label })

  for (const group of grouped(ctx, view.source, source, rows)) {
    const table = {
      type: 'table',
      columns,
      rows: group.rows.map((row, i) => {
        const id = rowId(row, i)
        const cells = {}
        for (const c of columns) cells[c.key] = display(ctx, view.source, fieldOf(source, c.key), row)
        const out = { id, cells }
        if (can.write) {
          out.actions = []
          if (source.sortable) {
            out.actions.push({ label: ctx.copy.moveUp, icon: '↑', style: 'ghost', disabled: i === 0, action: { type: 'record.move', source: view.source, id, direction: 'up' } })
            out.actions.push({ label: ctx.copy.moveDown, icon: '↓', style: 'ghost', disabled: i === group.rows.length - 1, action: { type: 'record.move', source: view.source, id, direction: 'down' } })
          }
          out.actions.push({ label: ctx.copy.edit, style: 'secondary', action: { type: 'view.edit', source: view.source, id } })
          out.actions.push({ label: ctx.copy.delete, style: 'danger', action: { type: 'record.delete', source: view.source, id } })
        }
        return out
      }),
    }
    if (!rows.length) table.empty = view.emptyText || ctx.copy.empty
    blocks.push(group.label ? section(group.label, [table]) : table)
  }
  if (!rows.length && !blocks.some((b) => b.type === 'table')) blocks.push({ type: 'empty', text: view.emptyText || ctx.copy.empty })
  return section(title, blocks)
}

function pick(row, fields) {
  const out = {}
  for (const f of fields || []) out[f.key] = row[f.key] ?? (f.type === 'boolean' ? false : null)
  return out
}

function settingsView(ctx, view) {
  const fields = settingsFields(ctx.manifest)
  if (!fields.length) return null
  const formId = 'settings'
  const current = {}
  for (const f of fields) current[f.key] = f.secret ? '' : ctx.settings[f.key] ?? (f.type === 'boolean' ? false : null)
  const form = {
    type: 'form',
    id: formId,
    fields: fields.map((f) => {
      const out = { key: f.key, label: f.label, type: f.secret ? 'secret' : f.type, required: f.required }
      if (f.help) out.help = f.help
      if (f.options) out.options = f.options
      return out
    }),
    values: ctx.actions.values?.[formId] ?? current,
    errors: ctx.actions.errors?.[formId] || {},
    submit: { label: ctx.copy.saveSettings, action: { type: 'settings.save' } },
  }
  if (ctx.actions.settings === false) form.readOnly = true
  return section(view.heading || ctx.copy.settings, [form])
}

/* ── public views ───────────────────────────────────────────────────────── */

function slot(ctx, sourceKey, source, view, name, row) {
  const key = view.fields?.[name]
  return key ? display(ctx, sourceKey, fieldOf(source, key), row) : ''
}

function rawSlot(view, name, row) {
  const key = view.fields?.[name]
  const v = key ? row[key] : undefined
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)
}

function listView(ctx, view, source, rows) {
  const style = view.style || 'list'
  const groups = grouped(ctx, view.source, source, rows)
  const titleKey = view.fields?.title || source.title
  const toItem = (row, i) => {
    const item = { id: rowId(row, i), title: display(ctx, view.source, fieldOf(source, titleKey), row) }
    for (const name of ['subtitle', 'body', 'value', 'badge']) {
      const text = slot(ctx, view.source, source, view, name, row)
      if (text) item[name] = text
    }
    const image = safeImage(rawSlot(view, 'image', row))
    if (image) item.image = { src: image, alt: item.title }
    const href = safeHref(rawSlot(view, 'link', row))
    if (href) item.href = href
    const meta = (view.fields?.meta || []).map((k) => {
      const f = fieldOf(source, k)
      const text = display(ctx, view.source, f, row)
      if (!text) return ''
      return f.type === 'number' ? `${text} ${f.label.toLowerCase()}` : text
    }).filter(Boolean)
    if (meta.length) item.meta = meta
    return item
  }
  if (groups.length === 1 && !groups[0].label) return [{ type: 'list', style, items: groups[0].rows.map(toItem) }]
  return groups.map((g) => section(g.label, [{ type: 'list', style, items: g.rows.map(toItem) }]))
}

function linksView(ctx, view, source, rows) {
  const style = view.style || 'stack'
  const labelField = fieldOf(source, view.fields?.label || source.title)
  const iconField = view.fields?.icon ? fieldOf(source, view.fields.icon) : null
  const lookups = ctx.lookupsBySource[view.source]
  const items = []
  for (const row of rows) {
    const href = safeHref(rawSlot(view, 'link', row))
    if (!href) continue
    const button = { label: display(ctx, view.source, labelField, row) || href, href }
    if (iconField) {
      const option = optionList(iconField, lookups).find((o) => String(o.value) === String(row[iconField.key]))
      if (option?.icon) button.icon = option.icon
    }
    const emphasis = rawSlot(view, 'emphasis', row)
    button.style = BUTTON_STYLES.includes(emphasis) ? emphasis : 'primary'
    const note = slot(ctx, view.source, source, view, 'note', row)
    if (note) button.note = note
    items.push(button)
  }
  return items.length ? [{ type: 'buttons', style, items }] : []
}

function imagesView(ctx, view, source, rows) {
  const items = []
  for (const row of rows) {
    const src = safeImage(rawSlot(view, 'image', row))
    if (!src) continue
    const caption = slot(ctx, view.source, source, view, 'caption', row)
    const item = { src, alt: caption || source.labelSingular }
    if (caption) item.caption = caption
    const href = safeHref(rawSlot(view, 'link', row))
    if (href) item.href = href
    items.push(item)
  }
  return items.length ? [{ type: 'images', style: view.style || 'grid', items }] : []
}

function detailsView(ctx, view, source, rows) {
  const summaryKey = view.fields?.summary || source.title
  const items = rows
    .map((row) => ({ summary: display(ctx, view.source, fieldOf(source, summaryKey), row), body: slot(ctx, view.source, source, view, 'body', row) }))
    .filter((it) => it.summary)
  return items.length ? [{ type: 'details', style: view.style || 'accordion', items }] : []
}

/**
 * Turn a link into an embeddable player URL, only through a provider the
 * screen was configured with (options.embeds). The engine knows no hosts.
 *   { hosts: [..], id: { from: 'query', param } | { from: 'path' }, pattern, src: 'https://…/{id}' }
 */
export function embedSrc(raw, providers) {
  if (!Array.isArray(providers) || !providers.length) return null
  let url
  try {
    url = new URL(String(raw))
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^www\./, '')
  for (const p of providers) {
    if (!p || !Array.isArray(p.hosts) || !p.hosts.includes(host) || typeof p.src !== 'string' || !p.src.startsWith('https://')) continue
    const from = p.id?.from === 'query' ? url.searchParams.get(p.id.param || '') : null
    const id = from || url.pathname.split('/').filter(Boolean).pop()
    if (!id) continue
    let pattern
    try {
      pattern = new RegExp(p.pattern || '^[A-Za-z0-9_-]{1,64}$')
    } catch {
      continue
    }
    if (!pattern.test(id)) continue
    return p.src.replace('{id}', encodeURIComponent(id))
  }
  return null
}

function embedView(ctx, view, source, rows) {
  const out = []
  for (const row of rows) {
    const src = embedSrc(rawSlot(view, 'link', row), ctx.options.embeds)
    if (!src) continue
    out.push({ type: 'embed', src, title: slot(ctx, view.source, source, view, 'title', row) || source.labelSingular })
  }
  return (view.style || 'feature') === 'feature' ? out.slice(0, 1) : out
}

function feedView(ctx, view, source, rows) {
  const items = newestFirst(rows).map((row, i) => {
    const item = { id: rowId(row, i), title: display(ctx, view.source, fieldOf(source, view.fields?.title || source.title), row) }
    for (const name of ['subtitle', 'body']) {
      const text = slot(ctx, view.source, source, view, name, row)
      if (text) item[name] = text
    }
    if (row.created_at) item.time = relativeTime(row.created_at, { now: ctx.now, locale: ctx.format.locale, copy: ctx.copy })
    return item
  })
  return items.length ? [{ type: 'list', style: view.style === 'cards' ? 'cards' : 'feed', items }] : []
}

function formView(ctx, view, source) {
  const open = view.openWhen ? ctx.settings[view.openWhen.setting] !== false : true
  if (!open) return [{ type: 'empty', text: view.closedText || ctx.copy.closed }]
  const formId = `${view.source}:visitor`
  const blocks = []
  const intro = settingText(ctx, view.intro)
  if (ctx.actions.submitted?.[formId]) {
    blocks.push({ type: 'notice', tone: 'success', text: ctx.copy.sent })
  }
  const fields = formFields(source, { visitor: true }, ctx.lookupsBySource[view.source])
  const form = {
    type: 'form',
    id: formId,
    fields,
    values: ctx.actions.values?.[formId] ?? blankValues(source.fields.filter((f) => !f.ownerOnly && !f.readOnly)),
    errors: ctx.actions.errors?.[formId] || {},
    submit: { label: view.submitLabel || ctx.copy.send, action: { type: 'form.submit', source: view.source } },
  }
  if (intro) form.intro = intro
  if (view.style === 'feature') form.style = 'feature'
  blocks.push(form)
  return blocks
}

function publicView(ctx, view, surface) {
  const title = view.heading ?? (surface.title || '')
  if (view.type === 'text') {
    const text = settingText(ctx, view.text)
    return text ? section(title, [{ type: 'text', text }]) : null
  }
  const source = ctx.sources[view.source]
  if (!abilities(ctx, source).read) return null
  if (view.type === 'form') return section(title, formView(ctx, view, source))
  const rows = visible(source, ordered(source, rowsOf(ctx, view.source)))
  const make = { list: listView, links: linksView, images: imagesView, details: detailsView, embed: embedView, feed: feedView }[view.type]
  const blocks = make ? make(ctx, view, source, rows) : []
  return section(title, blocks.length ? blocks : [{ type: 'empty', text: view.emptyText || ctx.copy.empty }])
}

/* ── entry points ───────────────────────────────────────────────────────── */

function renderViews(ctx, surface) {
  const name = String(surface.path || '').slice(1)
  const views = ctx.manifest.ui?.views?.[name] || []
  const isPublic = PUBLIC_KINDS.includes(surface.kind)
  const vctx = isPublic ? { ...ctx, visitor: true } : ctx
  const out = []
  for (const view of views) {
    let block = null
    if (view.type === 'collection' && !isPublic) block = collectionView(ctx, view)
    else if (view.type === 'settings' && !isPublic) block = settingsView(ctx, view)
    else if (view.type !== 'collection' && view.type !== 'settings') block = publicView(vctx, view, surface)
    if (block) out.push(block)
  }
  return out
}

function renderKinds(kinds, manifest, settings, data, actions, options) {
  const ctx = context(manifest, settings, data, actions, options)
  const surfaces = (manifest?.surfaces || []).filter((s) => kinds.includes(s.kind))
  return surfaces.flatMap((s) => renderViews(ctx, s))
}

/** The owner's screen (Play-user's app page; Boxes later). */
export function renderOwner(manifest, settings, data, actions = {}, options = {}) {
  return renderKinds(OWNER_KINDS, manifest, settings, data, actions, options)
}

/** The public block (gcr-unified's business page, the app's own link). */
export function renderPublic(manifest, settings, data, actions = {}, options = {}) {
  return renderKinds(PUBLIC_KINDS, manifest, settings, data, actions, options)
}

/** One surface by id — a TV card, a widget. */
export function renderSurface(manifest, surfaceId, settings, data, actions = {}, options = {}) {
  const surface = (manifest?.surfaces || []).find((s) => s.id === surfaceId)
  if (!surface) return []
  return renderViews(context(manifest, settings, data, actions, options), surface)
}

/** Which surfaces of each kind a manifest has — screens use it to decide what to offer. */
export function surfacesOf(manifest) {
  const list = manifest?.surfaces || []
  return {
    owner: list.filter((s) => OWNER_KINDS.includes(s.kind)).map((s) => s.id),
    public: list.filter((s) => PUBLIC_KINDS.includes(s.kind)).map((s) => s.id),
    other: list.filter((s) => !OWNER_KINDS.includes(s.kind) && !PUBLIC_KINDS.includes(s.kind)).map((s) => s.id),
  }
}

/**
 * The sources a surface kind reads, including the ones its select fields draw
 * options from — what a data adapter has to load before rendering.
 */
export function sourcesFor(manifest, which = 'owner') {
  const kinds = which === 'public' ? PUBLIC_KINDS : which === 'owner' ? OWNER_KINDS : null
  const surfaces = (manifest?.surfaces || []).filter((s) => (kinds ? kinds.includes(s.kind) : s.id === which))
  const sources = manifest?.ui?.sources || {}
  const out = new Set()
  for (const s of surfaces) {
    for (const v of manifest.ui?.views?.[String(s.path).slice(1)] || []) {
      if (!v.source || !sources[v.source]) continue
      out.add(v.source)
      for (const f of sources[v.source].fields || []) if (f.optionsFrom && sources[f.optionsFrom.source]) out.add(f.optionsFrom.source)
    }
  }
  return [...out]
}

/**
 * Check a record before it is sent: the same rules on every screen. Visitor
 * writes lose owner-only fields (reset to their defaults).
 */
export function checkRecord(manifest, sourceKey, values, { visitor = false, data } = {}) {
  const source = manifest?.ui?.sources?.[sourceKey]
  if (!source) return { ok: false, errors: { _form: `Unknown source "${sourceKey}".` } }
  const ctx = context(manifest, {}, data || {}, {}, {})
  return checkValues(source.fields, values, { visitor, lookups: ctx.lookupsBySource[sourceKey] })
}
