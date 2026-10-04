// The app manifest: app-manifest v1 (cybercheck-cloud contract/app-manifest.v1.json)
// plus the engine section that lets one shared runtime draw the app.
//
// validateManifest() runs, in order:
//   1. every check of the v1 JSON schema, reproduced field by field (no JSON
//      schema library: the engine has no dependencies);
//   2. the store's version rules (store-rules.js, identical to gcr-api-clean's
//      lib/storeManifest.js) when an item is given;
//   3. the engine's own consistency checks: every view names a real source,
//      every bound field exists, every app table it writes is declared public
//      the right way, every business source has its permission declared.
//
// Two places where this manifest goes beyond v1 (both reported upstream):
//   - runtime { type: "engine" } — v1 only knows "hosted" and "service";
//   - the top-level "ui" section — v1 forbids unknown top-level keys.
// And one place where v1 and the NEXT GENT contract disagree: v1 writes
// permission ids with dots (availability.read); CONTRACT §6, Paperclip and
// gcr-api-clean write resource:action (availability:read). The contract wins.

import { SEMVER, prepareVersion } from './store-rules.js'

export const SCHEMA_VERSION = 1
export const ENGINE_RUNTIME = 'engine'

/**
 * The manifest id is the store item key, so it follows Paperclip's rule for
 * one (server/src/routes/store.ts itemKeySchema, also services/store-content.ts):
 * lowercase letters, digits and dashes, 1 to 80 characters. v1's own pattern
 * allowed dots, which Paperclip refuses at publish time.
 */
const ID = /^[a-z0-9][a-z0-9-]*$/
const ID_MAX = 80
const PUBLISHER = /^[a-z][a-z0-9-]*$/
const SLUG = /^[a-z][a-z0-9-]*$/
const KEY = /^[a-z][a-z0-9_]*$/
const SURFACE_ID = /^[a-z][a-z0-9_-]*$/
const DOTTED = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/
const REL_PATH = /^\/[^\s]*$/
const PLATFORM = /^\^?\d+(\.\d+)?(\.\d+)?$/
const CURRENCY = /^[A-Z]{3}$/
/** CONTRACT §6 and Paperclip's NEXTGENT_PERMISSION_PATTERN. */
export const PERMISSION = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/

export const SURFACE_KINDS = ['dashboard', 'settings', 'public', 'widget', 'standalone']
export const DISPLAY_MODES = ['inline', 'card', 'compact', 'modal', 'page', 'full']
export const COLUMN_TYPES = ['text', 'integer', 'number', 'money', 'boolean', 'date', 'timestamp', 'json', 'uuid']
export const TABLE_PUBLIC = ['none', 'append', 'read', 'read-append']
export const CONFIG_TYPES = ['text', 'number', 'boolean', 'select', 'secret', 'url']
export const PRICING_MODELS = ['free', 'flat', 'usage']
export const INTERVALS = ['month', 'year']

/** Input types the engine can draw and check. */
export const FIELD_TYPES = [
  'text', 'longtext', 'number', 'money', 'boolean', 'select',
  'date', 'time', 'email', 'phone', 'url', 'image', 'color',
]

/** Which storage column types each field type may sit on, for app-owned tables. */
const COLUMN_FOR_FIELD = {
  text: ['text'], longtext: ['text'], select: ['text', 'integer', 'uuid'], email: ['text'], phone: ['text'],
  url: ['text'], image: ['text'], color: ['text'], time: ['text'],
  number: ['number', 'integer'], money: ['money', 'number'], boolean: ['boolean'], date: ['date', 'timestamp'],
}

/** View types and the field slots each binds (see README "Views"). */
export const VIEW_TYPES = {
  collection: { owner: true, slots: [] },
  settings: { owner: true, slots: [], noSource: true },
  list: { slots: ['title', 'subtitle', 'body', 'image', 'value', 'badge', 'link'], multi: ['meta'], styles: ['list', 'cards', 'grid'] },
  links: { slots: ['label', 'link', 'icon', 'emphasis', 'note'], styles: ['stack', 'inline', 'grid', 'icons'] },
  images: { slots: ['image', 'caption', 'link'], styles: ['grid', 'strip', 'feature'] },
  details: { slots: ['summary', 'body'], styles: ['accordion', 'list'] },
  embed: { slots: ['link', 'title'], styles: ['feature', 'stack'] },
  form: { slots: [], writes: true, styles: ['stack', 'feature'] },
  feed: { slots: ['title', 'subtitle', 'body'], styles: ['list', 'cards'] },
  text: { slots: [], noSource: true },
}

const TOP_LEVEL = [
  'schema_version', 'id', 'name', 'summary', 'description', 'version', 'publisher', 'homepage', 'icon',
  'categories', 'requires', 'runtime', 'surfaces', 'permissions', 'capabilities', 'data', 'events', 'config',
  'pricing', 'ui',
]

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string'

function isUri(v) {
  if (!isStr(v)) return false
  try {
    const u = new URL(v)
    return Boolean(u.protocol)
  } catch {
    return false
  }
}

/** An http(s) URI — the only kind a screen will link a visitor to. */
function isHttpUri(v) {
  if (!isStr(v)) return false
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function collector() {
  const errors = []
  const add = (path, message) => errors.push({ path, message })
  const only = (obj, allowed, path) => {
    for (const k of Object.keys(obj)) if (!allowed.includes(k)) add(path ? `${path}.${k}` : k, 'is not an allowed property.')
  }
  const str = (v, path, { min = 0, max = Infinity, pattern, required = false } = {}) => {
    if (v === undefined) {
      if (required) add(path, 'is required.')
      return false
    }
    if (!isStr(v)) return add(path, 'must be a string.'), false
    if (v.length < min) return add(path, `must be at least ${min} characters.`), false
    if (v.length > max) return add(path, `must be at most ${max} characters.`), false
    if (pattern && !pattern.test(v)) return add(path, `must match ${pattern}.`), false
    return true
  }
  const bool = (v, path) => {
    if (v !== undefined && typeof v !== 'boolean') add(path, 'must be true or false.')
  }
  const oneOf = (v, list, path) => {
    if (!list.includes(v)) add(path, `must be one of ${list.join(', ')}.`)
  }
  const arr = (v, path, { max = Infinity, min = 0 } = {}) => {
    if (v === undefined) return false
    if (!Array.isArray(v)) return add(path, 'must be a list.'), false
    if (v.length < min) return add(path, `must have at least ${min} entries.`), false
    if (v.length > max) return add(path, `must have at most ${max} entries.`), false
    return true
  }
  return { errors, add, only, str, bool, oneOf, arr }
}

/* ── 1. app-manifest v1 ─────────────────────────────────────────────────── */

function checkV1(m, c) {
  const { add, only, str, bool, oneOf, arr } = c
  only(m, TOP_LEVEL, '')
  for (const k of ['schema_version', 'id', 'name', 'version', 'publisher', 'runtime']) {
    if (m[k] === undefined) add(k, 'is required.')
  }
  if (m.schema_version !== undefined && m.schema_version !== SCHEMA_VERSION) add('schema_version', `must be ${SCHEMA_VERSION}.`)
  str(m.id, 'id', { max: ID_MAX, pattern: ID })
  str(m.name, 'name', { min: 1, max: 80 })
  str(m.summary, 'summary', { max: 200 })
  str(m.description, 'description', { max: 4000 })
  str(m.version, 'version', { pattern: SEMVER })
  str(m.publisher, 'publisher', { max: 48, pattern: PUBLISHER })
  if (m.homepage !== undefined && !isHttpUri(m.homepage)) add('homepage', 'must be an http or https URI.')
  str(m.icon, 'icon', { max: 512 })
  if (arr(m.categories, 'categories', { max: 6 })) {
    m.categories.forEach((cat, i) => str(cat, `categories[${i}]`, { pattern: SLUG, required: true }))
  }

  if (m.requires !== undefined) {
    if (!isObj(m.requires)) add('requires', 'must be an object.')
    else {
      only(m.requires, ['platform', 'apps'], 'requires')
      str(m.requires.platform, 'requires.platform', { pattern: PLATFORM })
      if (arr(m.requires.apps, 'requires.apps')) m.requires.apps.forEach((a, i) => str(a, `requires.apps[${i}]`, { max: ID_MAX, pattern: ID, required: true }))
    }
  }

  if (m.runtime !== undefined) checkRuntime(m.runtime, c)

  if (arr(m.surfaces, 'surfaces', { max: 24 })) {
    m.surfaces.forEach((s, i) => {
      const p = `surfaces[${i}]`
      if (!isObj(s)) return add(p, 'must be an object.')
      only(s, ['id', 'kind', 'title', 'icon', 'path', 'display_modes', 'requires_permission'], p)
      str(s.id, `${p}.id`, { max: 48, pattern: SURFACE_ID, required: true })
      if (s.kind === undefined) add(`${p}.kind`, 'is required.')
      else oneOf(s.kind, SURFACE_KINDS, `${p}.kind`)
      str(s.title, `${p}.title`, { max: 80 })
      str(s.icon, `${p}.icon`, { max: 512 })
      str(s.path, `${p}.path`, { max: 512, pattern: REL_PATH, required: true })
      if (arr(s.display_modes, `${p}.display_modes`)) s.display_modes.forEach((d, j) => oneOf(d, DISPLAY_MODES, `${p}.display_modes[${j}]`))
      str(s.requires_permission, `${p}.requires_permission`, { pattern: PERMISSION })
    })
  }

  if (arr(m.permissions, 'permissions', { max: 48 })) {
    m.permissions.forEach((perm, i) => {
      const p = `permissions[${i}]`
      if (!isObj(perm)) return add(p, 'must be an object with id and reason.')
      only(perm, ['id', 'reason', 'optional'], p)
      if (isStr(perm.id) && DOTTED.test(perm.id) && !PERMISSION.test(perm.id)) {
        add(`${p}.id`, `"${perm.id}" uses v1's dotted form; NEXT GENT permissions are resource:action (e.g. ${perm.id.replace('.', ':')}).`)
      } else {
        str(perm.id, `${p}.id`, { max: 96, pattern: PERMISSION, required: true })
      }
      str(perm.reason, `${p}.reason`, { min: 8, max: 200, required: true })
      bool(perm.optional, `${p}.optional`)
    })
    const ids = m.permissions.map((p) => p && p.id)
    const dup = ids.find((id, i) => id && ids.indexOf(id) !== i)
    if (dup) add('permissions', `"${dup}" is declared twice.`)
  }

  if (m.capabilities !== undefined) {
    if (!isObj(m.capabilities)) add('capabilities', 'must be an object.')
    else {
      only(m.capabilities, ['provides', 'consumes'], 'capabilities')
      if (arr(m.capabilities.provides, 'capabilities.provides')) {
        m.capabilities.provides.forEach((cap, i) => {
          const p = `capabilities.provides[${i}]`
          if (!isObj(cap)) return add(p, 'must be an object.')
          only(cap, ['id', 'summary', 'path'], p)
          str(cap.id, `${p}.id`, { pattern: DOTTED, required: true })
          str(cap.summary, `${p}.summary`, { max: 200 })
          str(cap.path, `${p}.path`, { pattern: REL_PATH })
        })
      }
      if (arr(m.capabilities.consumes, 'capabilities.consumes')) {
        m.capabilities.consumes.forEach((id, i) => str(id, `capabilities.consumes[${i}]`, { pattern: DOTTED, required: true }))
      }
    }
  }

  if (m.data !== undefined) checkData(m.data, c)

  if (m.events !== undefined) {
    if (!isObj(m.events)) add('events', 'must be an object.')
    else {
      only(m.events, ['emits', 'subscribes'], 'events')
      if (arr(m.events.emits, 'events.emits')) m.events.emits.forEach((e, i) => str(e, `events.emits[${i}]`, { pattern: DOTTED, required: true }))
      if (arr(m.events.subscribes, 'events.subscribes')) {
        m.events.subscribes.forEach((s, i) => {
          const p = `events.subscribes[${i}]`
          if (!isObj(s)) return add(p, 'must be an object.')
          only(s, ['event', 'path'], p)
          str(s.event, `${p}.event`, { pattern: DOTTED, required: true })
          str(s.path, `${p}.path`, { pattern: REL_PATH, required: true })
        })
      }
    }
  }

  if (arr(m.config, 'config', { max: 24 })) {
    m.config.forEach((f, i) => {
      const p = `config[${i}]`
      if (!isObj(f)) return add(p, 'must be an object.')
      only(f, ['key', 'label', 'type', 'required', 'default', 'options', 'help'], p)
      str(f.key, `${p}.key`, { max: 40, pattern: KEY, required: true })
      str(f.label, `${p}.label`, { max: 80, required: true })
      if (f.type === undefined) add(`${p}.type`, 'is required.')
      else oneOf(f.type, CONFIG_TYPES, `${p}.type`)
      bool(f.required, `${p}.required`)
      if (arr(f.options, `${p}.options`)) f.options.forEach((o, j) => str(o, `${p}.options[${j}]`, { required: true }))
      str(f.help, `${p}.help`, { max: 200 })
    })
    const keys = m.config.map((f) => f && f.key)
    const dup = keys.find((k, i) => k && keys.indexOf(k) !== i)
    if (dup) add('config', `setting "${dup}" is declared twice.`)
  }

  if (m.pricing !== undefined) {
    const pr = m.pricing
    if (!isObj(pr)) add('pricing', 'must be an object.')
    else {
      only(pr, ['model', 'amount', 'currency', 'interval'], 'pricing')
      if (pr.model === undefined) add('pricing.model', 'is required.')
      else oneOf(pr.model, PRICING_MODELS, 'pricing.model')
      if (pr.amount !== undefined && !(typeof pr.amount === 'number' && pr.amount >= 0)) add('pricing.amount', 'must be a number of 0 or more.')
      str(pr.currency, 'pricing.currency', { pattern: CURRENCY })
      if (pr.interval !== undefined) oneOf(pr.interval, INTERVALS, 'pricing.interval')
      if (pr.model === 'free' && (pr.amount !== undefined || pr.currency !== undefined)) add('pricing', 'a free app has no amount or currency.')
      if ((pr.model === 'flat' || pr.model === 'usage') && (pr.amount === undefined || pr.currency === undefined)) add('pricing', `a ${pr.model} price needs an amount and a currency.`)
    }
  }
}

function checkRuntime(rt, { add, only, str }) {
  if (!isObj(rt)) return add('runtime', 'must be an object.')
  if (rt.type === 'hosted') {
    only(rt, ['type', 'url'], 'runtime')
    if (str(rt.url, 'runtime.url', { pattern: /^https?:\/\//, required: true }) && !isUri(rt.url)) add('runtime.url', 'must be a URI.')
  } else if (rt.type === 'service') {
    only(rt, ['type', 'base_url', 'health_path'], 'runtime')
    if (str(rt.base_url, 'runtime.base_url', { pattern: /^https?:\/\//, required: true }) && !isUri(rt.base_url)) add('runtime.base_url', 'must be a URI.')
    str(rt.health_path, 'runtime.health_path')
  } else if (rt.type === ENGINE_RUNTIME) {
    // Extension: drawn by the shared engine; nothing of the app's runs anywhere.
    only(rt, ['type', 'engine'], 'runtime')
    str(rt.engine, 'runtime.engine', { pattern: PLATFORM })
  } else {
    add('runtime.type', `must be hosted, service or ${ENGINE_RUNTIME}.`)
  }
}

function checkData(data, { add, only, str, bool, oneOf, arr }) {
  if (!isObj(data)) return add('data', 'must be an object.')
  only(data, ['namespace', 'delete_on_uninstall', 'tables'], 'data')
  str(data.namespace, 'data.namespace', { max: 40, pattern: KEY, required: true })
  bool(data.delete_on_uninstall, 'data.delete_on_uninstall')
  if (data.tables === undefined) return
  if (!isObj(data.tables)) return add('data.tables', 'must be an object.')
  const names = Object.keys(data.tables)
  if (names.length > 24) add('data.tables', 'must have at most 24 tables.')
  for (const name of names) {
    const p = `data.tables.${name}`
    if (!KEY.test(name) || name.length > 40) add(p, 'table names are snake_case, at most 40 characters.')
    const t = data.tables[name]
    if (!isObj(t)) {
      add(p, 'must be an object.')
      continue
    }
    only(t, ['columns', 'public', 'indexes'], p)
    if (!isObj(t.columns)) add(`${p}.columns`, 'is required.')
    else {
      const cols = Object.keys(t.columns)
      if (cols.length < 1 || cols.length > 40) add(`${p}.columns`, 'must have 1 to 40 columns.')
      for (const col of cols) {
        const cp = `${p}.columns.${col}`
        if (!KEY.test(col) || col.length > 40) add(cp, 'column names are snake_case, at most 40 characters.')
        const def = t.columns[col]
        if (!isObj(def)) {
          add(cp, 'must be an object.')
          continue
        }
        only(def, ['type', 'required', 'default', 'max_length'], cp)
        if (def.type === undefined) add(`${cp}.type`, 'is required.')
        else oneOf(def.type, COLUMN_TYPES, `${cp}.type`)
        bool(def.required, `${cp}.required`)
        if (def.max_length !== undefined && !(Number.isInteger(def.max_length) && def.max_length >= 1 && def.max_length <= 10000)) {
          add(`${cp}.max_length`, 'must be a whole number from 1 to 10000.')
        }
      }
    }
    if (t.public !== undefined) oneOf(t.public, TABLE_PUBLIC, `${p}.public`)
    if (arr(t.indexes, `${p}.indexes`, { max: 6 })) {
      t.indexes.forEach((ix, i) => {
        if (arr(ix, `${p}.indexes[${i}]`, { min: 1, max: 3 })) ix.forEach((col, j) => str(col, `${p}.indexes[${i}][${j}]`, { pattern: KEY, required: true }))
      })
    }
  }
}

/* ── 3. the engine section ──────────────────────────────────────────────── */

function resourceOf(permission) {
  return String(permission).split(':')[0]
}

function checkField(f, p, c, source) {
  const { add, only, str, bool, oneOf } = c
  if (!isObj(f)) return add(p, 'must be an object.')
  only(f, ['key', 'label', 'type', 'required', 'help', 'placeholder', 'options', 'optionsFrom', 'min', 'max', 'maxLength', 'default', 'ownerOnly', 'readOnly'], p)
  str(f.key, `${p}.key`, { max: 48, pattern: KEY, required: true })
  str(f.label, `${p}.label`, { min: 1, max: 80, required: true })
  if (f.type === undefined) add(`${p}.type`, 'is required.')
  else oneOf(f.type, FIELD_TYPES, `${p}.type`)
  bool(f.required, `${p}.required`)
  bool(f.ownerOnly, `${p}.ownerOnly`)
  bool(f.readOnly, `${p}.readOnly`)
  str(f.help, `${p}.help`, { max: 200 })
  str(f.placeholder, `${p}.placeholder`, { max: 120 })
  for (const n of ['min', 'max']) if (f[n] !== undefined && typeof f[n] !== 'number') add(`${p}.${n}`, 'must be a number.')
  if (f.maxLength !== undefined && !(Number.isInteger(f.maxLength) && f.maxLength > 0 && f.maxLength <= 10000)) add(`${p}.maxLength`, 'must be a whole number from 1 to 10000.')
  if (f.options !== undefined) {
    if (!Array.isArray(f.options)) add(`${p}.options`, 'must be a list.')
    else {
      f.options.forEach((o, i) => {
        const op = `${p}.options[${i}]`
        if (!isObj(o)) return add(op, 'must be { value, label }.')
        only(o, ['value', 'label', 'icon'], op)
        str(o.value, `${op}.value`, { min: 1, max: 80, required: true })
        str(o.label, `${op}.label`, { min: 1, max: 80, required: true })
        str(o.icon, `${op}.icon`, { max: 16 })
      })
      const values = f.options.map((o) => o && o.value)
      const dup = values.find((v, i) => v && values.indexOf(v) !== i)
      if (dup) add(`${p}.options`, `"${dup}" is listed twice.`)
    }
  }
  if (f.optionsFrom !== undefined) {
    const of = f.optionsFrom
    if (!isObj(of)) add(`${p}.optionsFrom`, 'must be { source, label }.')
    else {
      only(of, ['source', 'value', 'label'], `${p}.optionsFrom`)
      str(of.source, `${p}.optionsFrom.source`, { pattern: KEY, required: true })
      str(of.label, `${p}.optionsFrom.label`, { pattern: KEY, required: true })
      str(of.value, `${p}.optionsFrom.value`, { pattern: KEY })
      if (of.source === source) add(`${p}.optionsFrom.source`, 'cannot be the field’s own source.')
    }
  }
  if (f.type === 'select' && !(Array.isArray(f.options) && f.options.length) && !f.optionsFrom) {
    add(p, `select field "${f.key}" needs options or optionsFrom.`)
  }
}

function checkEngine(m, c) {
  const { add, only, str, bool, oneOf } = c
  const engine = isObj(m.runtime) && m.runtime.type === ENGINE_RUNTIME
  if (!engine) {
    if (m.ui !== undefined) add('ui', `is only read for runtime.type "${ENGINE_RUNTIME}".`)
    return
  }
  const ui = m.ui
  if (!isObj(ui)) return add('ui', `is required when runtime.type is "${ENGINE_RUNTIME}".`)
  only(ui, ['sources', 'views', 'format'], 'ui')

  const permissions = Array.isArray(m.permissions) ? m.permissions.filter(isObj) : []
  const declared = new Set(permissions.map((p) => p.id))
  const tables = isObj(m.data) && isObj(m.data.tables) ? m.data.tables : {}
  const config = Array.isArray(m.config) ? m.config.filter(isObj) : []
  const configKeys = new Set(config.map((f) => f.key))
  const settingRef = (v, p) => {
    if (v === undefined) return
    if (isStr(v)) return
    if (!isObj(v) || !isStr(v.setting)) return add(p, 'must be text or { setting: key }.')
    only(v, ['setting'], p)
    if (!configKeys.has(v.setting)) add(p, `names unknown setting "${v.setting}".`)
  }

  if (ui.format !== undefined) {
    if (!isObj(ui.format)) add('ui.format', 'must be an object.')
    else {
      only(ui.format, ['currency', 'locale'], 'ui.format')
      settingRef(ui.format.currency, 'ui.format.currency')
      settingRef(ui.format.locale, 'ui.format.locale')
    }
  }

  // Sources: where a view's rows come from.
  const sources = isObj(ui.sources) ? ui.sources : {}
  if (!isObj(ui.sources)) add('ui.sources', 'is required (it may be empty).')
  const fieldsOf = {}
  for (const [key, s] of Object.entries(sources)) {
    const p = `ui.sources.${key}`
    if (!KEY.test(key)) add(p, 'source keys are snake_case.')
    if (!isObj(s)) {
      add(p, 'must be an object.')
      continue
    }
    only(s, ['from', 'table', 'section', 'resource', 'label', 'labelSingular', 'fields', 'title', 'subtitle', 'group', 'order', 'sortable', 'visibleWhen', 'limit'], p)
    oneOf(s.from, ['app', 'business'], `${p}.from`)
    str(s.label, `${p}.label`, { min: 1, max: 60, required: true })
    str(s.labelSingular, `${p}.labelSingular`, { min: 1, max: 60, required: true })
    bool(s.sortable, `${p}.sortable`)
    if (s.limit !== undefined && !(Number.isInteger(s.limit) && s.limit > 0 && s.limit <= 500)) add(`${p}.limit`, 'must be a whole number from 1 to 500.')
    if (s.from === 'app') {
      if (s.section !== undefined || s.resource !== undefined) add(p, 'an app source names a table, not a section or resource.')
      if (str(s.table, `${p}.table`, { pattern: KEY, required: true }) && !tables[s.table]) add(`${p}.table`, `names table "${s.table}", which data.tables does not declare.`)
    }
    if (s.from === 'business') {
      if (s.table !== undefined) add(`${p}.table`, 'a business source names a section, not a table.')
      str(s.section, `${p}.section`, { pattern: KEY, required: true })
      if (str(s.resource, `${p}.resource`, { pattern: /^[a-z][a-z0-9_-]*$/, required: true }) && !declared.has(`${s.resource}:read`)) {
        add(`${p}.resource`, `reads business data, so permissions must declare "${s.resource}:read".`)
      }
    }
    if (!Array.isArray(s.fields) || s.fields.length < 1 || s.fields.length > 40) {
      add(`${p}.fields`, 'must list 1 to 40 fields.')
      fieldsOf[key] = []
      continue
    }
    s.fields.forEach((f, i) => checkField(f, `${p}.fields[${i}]`, c, key))
    const keys = s.fields.filter(isObj).map((f) => f.key)
    fieldsOf[key] = s.fields.filter(isObj)
    const dup = keys.find((k, i) => keys.indexOf(k) !== i)
    if (dup) add(`${p}.fields`, `field "${dup}" is declared twice.`)
    for (const ref of ['title', 'subtitle', 'group', 'order', 'visibleWhen']) {
      if (s[ref] === undefined) {
        if (ref === 'title') add(`${p}.title`, 'is required.')
        continue
      }
      if (ref === 'order') {
        // The order column may be bookkeeping the owner never edits.
        str(s.order, `${p}.order`, { pattern: KEY })
        continue
      }
      if (!keys.includes(s[ref])) add(`${p}.${ref}`, `names unknown field "${s[ref]}".`)
    }
    if (s.sortable && !s.order) add(`${p}.order`, 'a sortable source names the column that holds its order.')
    if (s.visibleWhen) {
      const flag = s.fields.find((f) => isObj(f) && f.key === s.visibleWhen)
      if (flag && flag.type !== 'boolean') add(`${p}.visibleWhen`, 'must name a boolean field.')
    }
    if (s.group) {
      const g = s.fields.find((f) => isObj(f) && f.key === s.group)
      if (g && g.type !== 'select') add(`${p}.group`, 'must name a select field.')
    }
    if (s.from === 'app' && tables[s.table] && isObj(tables[s.table].columns)) {
      const cols = tables[s.table].columns
      s.fields.forEach((f, i) => {
        if (!isObj(f) || !isStr(f.key)) return
        const col = cols[f.key]
        if (!col) return add(`${p}.fields[${i}].key`, `"${f.key}" is not a column of table "${s.table}".`)
        const allowed = COLUMN_FOR_FIELD[f.type]
        if (allowed && isObj(col) && !allowed.includes(col.type)) add(`${p}.fields[${i}].type`, `a ${f.type} field cannot sit on a ${col.type} column.`)
      })
      if (s.order && !cols[s.order]) add(`${p}.order`, `"${s.order}" is not a column of table "${s.table}".`)
    }
  }
  // optionsFrom must point at a real source and a real field of it.
  for (const [key, fields] of Object.entries(fieldsOf)) {
    fields.forEach((f, i) => {
      const of = f.optionsFrom
      if (!isObj(of) || !isStr(of.source)) return
      if (!sources[of.source]) return add(`ui.sources.${key}.fields[${i}].optionsFrom.source`, `names unknown source "${of.source}".`)
      const theirs = (fieldsOf[of.source] || []).map((x) => x.key)
      if (isStr(of.label) && !theirs.includes(of.label)) add(`ui.sources.${key}.fields[${i}].optionsFrom.label`, `"${of.label}" is not a field of source "${of.source}".`)
    })
  }

  // Views: what each surface shows. Every engine surface's path is /<view key>.
  const views = isObj(ui.views) ? ui.views : {}
  if (!isObj(ui.views)) add('ui.views', 'is required.')
  const surfaces = Array.isArray(m.surfaces) ? m.surfaces.filter(isObj) : []
  if (!surfaces.length) add('surfaces', 'an engine app declares at least one surface.')
  const surfaceFor = {}
  surfaces.forEach((s, i) => {
    const name = isStr(s.path) ? s.path.slice(1) : ''
    if (!views[name]) add(`surfaces[${i}].path`, `must be "/<view set>"; ui.views has no "${name}".`)
    else (surfaceFor[name] = surfaceFor[name] || []).push(s)
  })
  for (const [name, list] of Object.entries(views)) {
    const vp = `ui.views.${name}`
    if (!surfaceFor[name]) add(vp, 'no surface points at this view set.')
    if (!Array.isArray(list) || !list.length) {
      add(vp, 'must list at least one view.')
      continue
    }
    // One public surface on a view set makes it public, whatever else points at it.
    const isPublic = Boolean(surfaceFor[name] && surfaceFor[name].some((s) => s.kind === 'public'))
    list.forEach((v, i) => checkView(v, `${vp}[${i}]`, { c, sources, fieldsOf, tables, declared, isPublic, settingRef, configKeys }))
  }
}

function checkView(v, p, ctx) {
  const { c, sources, fieldsOf, tables, declared, isPublic, settingRef, configKeys } = ctx
  const { add, only, str, oneOf } = c
  if (!isObj(v)) return add(p, 'must be an object.')
  const spec = VIEW_TYPES[v.type]
  if (!spec) return add(`${p}.type`, `must be one of ${Object.keys(VIEW_TYPES).join(', ')}.`)
  only(v, ['type', 'source', 'heading', 'style', 'fields', 'submitLabel', 'intro', 'openWhen', 'text', 'closedText', 'emptyText'], p)
  str(v.heading, `${p}.heading`, { max: 80 })
  str(v.submitLabel, `${p}.submitLabel`, { max: 60 })
  settingRef(v.intro, `${p}.intro`)
  settingRef(v.text, `${p}.text`)
  str(v.closedText, `${p}.closedText`, { max: 200 })
  str(v.emptyText, `${p}.emptyText`, { max: 200 })
  if (v.openWhen !== undefined) {
    if (!isObj(v.openWhen) || !isStr(v.openWhen.setting)) add(`${p}.openWhen`, 'must be { setting: key }.')
    else if (!configKeys.has(v.openWhen.setting)) add(`${p}.openWhen`, `names unknown setting "${v.openWhen.setting}".`)
  }
  if (v.style !== undefined) {
    if (!spec.styles) add(`${p}.style`, `a ${v.type} view has no styles.`)
    else oneOf(v.style, spec.styles, `${p}.style`)
  }
  if (spec.owner && isPublic) add(p, `a ${v.type} view is for the owner; it cannot be on a public surface.`)
  if (v.type === 'text' && v.text === undefined) add(`${p}.text`, 'is required.')
  if (spec.noSource) {
    if (v.source !== undefined) add(`${p}.source`, `a ${v.type} view takes no source.`)
    return
  }
  if (!str(v.source, `${p}.source`, { pattern: KEY, required: true })) return
  const source = sources[v.source]
  if (!isObj(source)) return add(`${p}.source`, `names unknown source "${v.source}".`)
  const fields = fieldsOf[v.source] || []
  const keys = fields.map((f) => f.key)

  if (v.fields !== undefined) {
    if (!isObj(v.fields)) add(`${p}.fields`, 'must be an object of slot: field.')
    else {
      only(v.fields, [...spec.slots, ...(spec.multi || [])], `${p}.fields`)
      for (const [slot, ref] of Object.entries(v.fields)) {
        const refs = (spec.multi || []).includes(slot) ? ref : [ref]
        if (!Array.isArray(refs) || refs.length > 4) {
          add(`${p}.fields.${slot}`, 'must list at most 4 fields.')
          continue
        }
        for (const r of refs) {
          if (!keys.includes(r)) {
            add(`${p}.fields.${slot}`, `names unknown field "${r}".`)
            continue
          }
          const f = fields.find((x) => x.key === r)
          if (isPublic && f.ownerOnly) add(`${p}.fields.${slot}`, `"${r}" is owner-only and cannot be shown publicly.`)
          if (slot === 'icon' && f.type !== 'select') add(`${p}.fields.icon`, 'must name a select field (its options carry the icons).')
        }
      }
    }
  }
  // Slots that fall back to the source's title when unbound (render.js).
  const defaultSlot = { list: 'title', feed: 'title', links: 'label', details: 'summary' }[v.type]
  if (isPublic && defaultSlot && !(isObj(v.fields) && v.fields[defaultSlot] !== undefined)) {
    const titleField = fields.find((x) => x.key === source.title)
    if (titleField && titleField.ownerOnly) add(`${p}.fields.${defaultSlot}`, `defaults to the source title "${source.title}", which is owner-only and cannot be shown publicly.`)
  }
  for (const required of { links: ['link'], images: ['image'], details: ['body'], embed: ['link'] }[v.type] || []) {
    if (!isObj(v.fields) || !v.fields[required]) add(`${p}.fields.${required}`, `a ${v.type} view needs its ${required} field.`)
  }

  // Who may read or write what.
  if (isPublic && source.from === 'app') {
    const access = (tables[source.table] && tables[source.table].public) || 'none'
    if (spec.writes && !access.includes('append')) add(p, `writes to table "${source.table}", which is not public "append".`)
    if (!spec.writes && !access.startsWith('read')) add(p, `shows table "${source.table}", which is not public "read".`)
  }
  if (spec.writes && source.from === 'business' && !declared.has(`${source.resource}:write`)) {
    add(p, `writes business data, so permissions must declare "${source.resource}:write".`)
  }
}

/* ── the one entry point ───────────────────────────────────────────────── */

/**
 * Check a manifest. Pass `item` ({ key, kind, name, publisher }) and
 * `semver` to also apply the store's version rules exactly as the store does.
 *
 * @returns {{ ok: boolean, errors: { path: string, message: string }[], manifest: object | null }}
 */
export function validateManifest(input, { item, semver } = {}) {
  let manifest = input
  const c = collector()
  if (!isObj(manifest)) return { ok: false, errors: [{ path: '', message: 'A manifest is an object.' }], manifest: null }
  if (item) {
    const prepared = prepareVersion(item, { semver: semver ?? manifest.version, manifest })
    if (!prepared.ok) return { ok: false, errors: [{ path: '', message: prepared.error }], manifest: null }
    manifest = prepared.manifest
  }
  checkV1(manifest, c)
  checkEngine(manifest, c)
  return { ok: c.errors.length === 0, errors: c.errors, manifest: c.errors.length ? null : manifest }
}

/** Throwing form, for code that only ever handles valid manifests. */
export function parseManifest(input, options) {
  const result = validateManifest(input, options)
  if (!result.ok) {
    const first = result.errors.slice(0, 5).map((e) => (e.path ? `${e.path} ${e.message}` : e.message)).join(' ')
    throw new Error(`Invalid app manifest: ${first}`)
  }
  return result.manifest
}

/** Declared permissions split the way the install screen shows them. */
export function permissionsOf(manifest) {
  const list = Array.isArray(manifest?.permissions) ? manifest.permissions : []
  return {
    required: list.filter((p) => !p.optional).map((p) => ({ id: p.id, reason: p.reason })),
    optional: list.filter((p) => p.optional).map((p) => ({ id: p.id, reason: p.reason })),
  }
}

/** The resources a manifest touches, from its permissions. */
export function resourcesOf(manifest) {
  const list = Array.isArray(manifest?.permissions) ? manifest.permissions : []
  return [...new Set(list.map((p) => resourceOf(p.id)))].sort()
}
