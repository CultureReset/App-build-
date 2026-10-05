// What every view — core (render.js) or template (views/*.js) — builds blocks
// with. Pure functions over the render context; no view type is named here,
// so a template module depends on this file and the block vocabulary only.
//
// `ctx` is what render.js's context() returns: manifest, sources, granted,
// settings, data, actions, options, copy, format, lookupsBySource, now,
// visitor (true on a public surface) and can(source) → { read, write }.

import { blankValues, safeHref, safeImage, tagList } from './values.js'
import { formatValue, optionList, formatDate } from './format.js'
import { fill } from './copy.js'

export function rowsOf(ctx, key) {
  const rows = ctx.data[key]
  return Array.isArray(rows) ? rows.filter((r) => r && typeof r === 'object') : []
}

export function fieldOf(source, key) {
  return (source.fields || []).find((f) => f.key === key)
}

/** Display text for a field of a row. Owner-only fields are never drawn for a visitor. */
export function display(ctx, sourceKey, field, row) {
  if (!field || (ctx.visitor && field.ownerOnly)) return ''
  return formatValue(field, row[field.key], { ...ctx.format, copy: ctx.copy, lookups: ctx.lookupsBySource[sourceKey] })
}

export function rowId(row, index) {
  return row.id !== undefined && row.id !== null ? String(row.id) : `row-${index}`
}

export function ordered(source, rows) {
  if (!source.order) return rows
  return [...rows].sort((a, b) => (Number(a[source.order]) || 0) - (Number(b[source.order]) || 0))
}

export function newestFirst(rows) {
  return [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
}

/** Rows with the source's visibility flag off never reach a visitor. */
export function visible(source, rows) {
  if (!source.visibleWhen) return rows
  return rows.filter((r) => r[source.visibleWhen] !== false && r[source.visibleWhen] !== 'false')
}

export function isOn(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

/** Split rows into the group field's options, in option order; leftovers last. */
export function grouped(ctx, sourceKey, source, rows) {
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

/** Group rows by the distinct display values of one field, in first-seen order. */
export function groupedByValue(ctx, sourceKey, source, field, rows) {
  if (!field) return [{ key: '', label: '', rows }]
  const groups = []
  for (const row of rows) {
    const label = display(ctx, sourceKey, field, row)
    const key = label ? slug(label) : '__other'
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, label: label || ctx.copy.other, rows: [] }))
    g.rows.push(row)
  }
  return groups
}

export function settingText(ctx, ref) {
  if (typeof ref === 'string') return ref
  if (ref && typeof ref === 'object' && ref.setting) {
    const v = ctx.settings[ref.setting]
    return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)
  }
  return ''
}

export function formFields(source, { visitor }, lookups, onlyKeys) {
  return (source.fields || [])
    .filter((f) => !f.readOnly && !(visitor && f.ownerOnly) && (!onlyKeys || onlyKeys.includes(f.key)))
    .map((f) => {
      const out = { key: f.key, label: f.label, type: f.type, required: Boolean(f.required) }
      for (const k of ['help', 'placeholder', 'min', 'max', 'maxLength']) if (f[k] !== undefined) out[k] = f[k]
      if (f.type === 'select') out.options = optionList(f, lookups).map((o) => ({ value: String(o.value), label: o.label }))
      return out
    })
}

export function section(title, blocks, extra) {
  const out = { type: 'section', blocks }
  if (title) out.title = title
  if (extra) for (const [k, v] of Object.entries(extra)) if (v !== undefined) out[k] = v
  return out
}

/** The display text of the field a view bound to a slot, or ''. */
export function slot(ctx, sourceKey, source, view, name, row) {
  const key = view.fields?.[name]
  return key ? display(ctx, sourceKey, fieldOf(source, key), row) : ''
}

/** The raw stored value of a bound slot as text (for links and images, which are checked, not formatted). */
export function rawSlot(view, name, row) {
  const key = view.fields?.[name]
  const v = key ? row[key] : undefined
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)
}

/** The raw stored value of a bound slot, untouched (booleans, numbers, arrays). */
export function rawValue(view, name, row) {
  const key = view.fields?.[name]
  return key ? row[key] : undefined
}

/** A list of short texts from a slot (a `tags` field, or text): an array as stored, or comma-separated text. */
export function listSlot(view, name, row) {
  return tagList(rawValue(view, name, row)) || []
}

export function imageSlot(view, name, row, alt) {
  const src = safeImage(rawSlot(view, name, row))
  return src ? { src, alt: alt || '' } : null
}

export function linkSlot(view, name, row) {
  return safeHref(rawSlot(view, name, row))
}

export function pick(row, fields) {
  const out = {}
  for (const f of fields || []) out[f.key] = row[f.key] ?? (f.type === 'boolean' ? false : null)
  return out
}

/** A CSS-safe key from text: lowercase letters, digits and dashes, at most 40 characters. */
export function slug(text) {
  const s = String(text ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')
  return s || 'x'
}

/**
 * The add button and, while a row of this source is being edited, its form —
 * what every owner view puts above its rows. Returns [] when the viewer may
 * not write.
 */
export function editorBlocks(ctx, sourceKey, source, rows, { can, onlyKeys } = {}) {
  const able = can || ctx.can(source)
  if (!able.write) return []
  const editing = ctx.actions.editing && ctx.actions.editing.source === sourceKey ? ctx.actions.editing : null
  const label = fill(ctx.copy.add, { item: source.labelSingular.toLowerCase() })
  if (!editing) return [{ type: 'button', label, style: 'primary', action: { type: 'view.new', source: sourceKey } }]
  const existing = editing.id === null || editing.id === undefined ? null : rows.find((r, i) => rowId(r, i) === String(editing.id))
  const formId = `${sourceKey}:${existing ? rowId(existing, 0) : 'new'}`
  const fields = formFields(source, { visitor: false }, ctx.lookupsBySource[sourceKey], onlyKeys)
  const values = ctx.actions.values?.[formId] ?? (existing ? pick(existing, source.fields) : blankValues(source.fields))
  return [{
    type: 'form',
    id: formId,
    fields,
    values,
    errors: ctx.actions.errors?.[formId] || {},
    submit: {
      label: existing ? ctx.copy.save : label,
      action: existing ? { type: 'record.update', source: sourceKey, id: rowId(existing, 0) } : { type: 'record.create', source: sourceKey },
    },
    cancel: { label: ctx.copy.cancel, style: 'secondary', action: { type: 'view.cancel', source: sourceKey } },
  }]
}

/** Move up / move down buttons for a sortable source's row. */
export function moveButtons(ctx, sourceKey, source, id, index, count) {
  if (!source.sortable) return []
  return [
    { label: ctx.copy.moveUp, icon: '↑', style: 'ghost', disabled: index === 0, action: { type: 'record.move', source: sourceKey, id, direction: 'up' } },
    { label: ctx.copy.moveDown, icon: '↓', style: 'ghost', disabled: index === count - 1, action: { type: 'record.move', source: sourceKey, id, direction: 'down' } },
  ]
}

export function editDeleteButtons(ctx, sourceKey, id) {
  return [
    { label: ctx.copy.edit, style: 'secondary', action: { type: 'view.edit', source: sourceKey, id } },
    { label: ctx.copy.delete, style: 'danger', action: { type: 'record.delete', source: sourceKey, id } },
  ]
}

/** A one-field form inside a row (inline edit): submits a partial update of that field. */
export function inlineForm(ctx, sourceKey, source, row, id, fieldKey) {
  const field = fieldOf(source, fieldKey)
  if (!field || field.readOnly) return null
  const formId = `${sourceKey}:${id}:${fieldKey}`
  return {
    type: 'form',
    id: formId,
    fields: formFields(source, { visitor: false }, ctx.lookupsBySource[sourceKey], [fieldKey]),
    values: ctx.actions.values?.[formId] ?? { [fieldKey]: row[fieldKey] ?? null },
    errors: ctx.actions.errors?.[formId] || {},
    submit: { label: ctx.copy.save, action: { type: 'record.update', source: sourceKey, id } },
  }
}

/** A button that flips one boolean field of a row (a quick update, no form). */
export function toggleButton(ctx, sourceKey, source, row, id, fieldKey, { onLabel, offLabel }) {
  const field = fieldOf(source, fieldKey)
  if (!field || field.type !== 'boolean') return null
  const on = isOn(row[fieldKey])
  return { label: on ? onLabel : offLabel, style: 'secondary', action: { type: 'record.update', source: sourceKey, id, values: { [fieldKey]: !on } } }
}

/* ── contact points: the row of ways to reach a business ───────────────── */

/** Slot → link scheme, label (copy key) and key. Order is the order drawn. */
export const CONTACT_SLOTS = [
  { slot: 'phone', key: 'call', scheme: 'tel:', copy: 'call' },
  { slot: 'sms', key: 'sms', scheme: 'sms:', copy: 'sms' },
  { slot: 'email', key: 'email', scheme: 'mailto:', copy: 'email' },
  { slot: 'link', key: 'website', copy: 'website' },
  { slot: 'book', key: 'book', copy: 'book' },
  { slot: 'directions', key: 'directions', copy: 'directions' },
]

/** Buttons for every contact slot the view bound and the row fills. */
export function contactButtons(ctx, view, row) {
  const out = []
  for (const c of CONTACT_SLOTS) {
    const raw = rawSlot(view, c.slot, row).trim()
    if (!raw) continue
    const href = c.scheme ? safeHref(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `${c.scheme}${raw.replace(/\s+/g, '')}`) : safeHref(raw)
    if (!href) continue
    out.push({ label: ctx.copy[c.copy], href, key: c.key, style: out.length ? 'secondary' : 'primary' })
  }
  return out
}

/* ── calendar days ──────────────────────────────────────────────────────── */

const DAY = 86400000
const isoDate = (d) => new Date(d).toISOString().slice(0, 10)
const addDays = (iso, n) => isoDate(Date.parse(`${iso}T00:00:00Z`) + n * DAY)

function weekdayLabels(locale) {
  // Sunday first (getUTCDay() === 0), so `weekday` on a day is its column.
  const base = Date.parse('2026-03-01T00:00:00Z') // a Sunday
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    try {
      return new Date(base + i * DAY).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
    } catch {
      return String(i)
    }
  })
}

function monthTitle(iso, locale) {
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  } catch {
    return iso.slice(0, 7)
  }
}

/**
 * Entries ({ date, end?, ... }) laid onto days. `style`:
 *   list   only the dates that have entries, ascending
 *   month  every day of the month `now` falls in
 *   week   seven days from `now`
 * An entry with an end date (inclusive) appears on every day it covers, up to 62.
 */
export function calendarDays(entries, { style, now, locale }) {
  const today = isoDate(now)
  const byDate = new Map()
  const put = (date, entry) => {
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(entry)
  }
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))) continue
    const { end, ...rest } = e
    let d = e.date
    let n = 0
    const last = end && /^\d{4}-\d{2}-\d{2}$/.test(String(end)) && end >= e.date ? end : e.date
    while (d <= last && n < 62) {
      put(d, rest)
      d = addDays(d, 1)
      n++
    }
  }
  let dates
  let title
  if (style === 'month') {
    const first = `${today.slice(0, 8)}01`
    const count = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()
    dates = Array.from({ length: count }, (_, i) => addDays(first, i))
    title = monthTitle(first, locale)
  } else if (style === 'week') {
    dates = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  } else {
    dates = [...byDate.keys()].sort()
  }
  const days = dates.map((date) => {
    const d = new Date(`${date}T00:00:00Z`)
    const day = { date, label: style === 'list' ? formatDate(date, { locale }) : String(d.getUTCDate()), weekday: d.getUTCDay(), entries: byDate.get(date) || [] }
    if (date === today) day.today = true
    return day
  })
  const out = { type: 'calendar', style, weekdays: weekdayLabels(locale), days }
  if (title) out.title = title
  return out
}
