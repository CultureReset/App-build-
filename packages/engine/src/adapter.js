// Data access. The engine never holds a database client: every read and write
// goes to gcr-api-clean over HTTP with the install's token, and gcr-api-clean
// decides which business that is (from the token, never from the request) and
// what the token may touch (CONTRACT §6 permissions).
//
// Two kinds of source (manifest ui.sources):
//   business  the business's own data. Through a binding (DECISIONS #45) the
//             path names the data contract — /api/business/<contract> — and
//             gcr-api-clean's registry (lib/dataContracts.js) resolves it to a
//             table, filter and resource. The older form names a section
//             (the raw table) — /api/business/<section>.
//   app       records the app keeps for itself, in its own data space behind
//             gcr-api-clean (plan §7) — /api/app-data/<table>
//
// A binding's fieldMap ({ field: column }) is applied here, both ways: rows
// come back under the manifest's field keys, writes go out under the columns.
// Format bindings (ui.format.currency: { binding }) are read on load() into
// `business`, keyed by binding, for the renderer's options.business.
//
// `baseUrl` is wherever /api/* of gcr-api-clean is reachable from the caller:
// gcr-api-clean's own /api, or a screen's proxy (Play-user's /biz).

import { checkRecord, sourcesFor } from './render.js'
import { configKeys } from './store-rules.js'

export const DEFAULT_ROUTES = Object.freeze({
  // gcr-api-clean routes/business-data.js: a data contract by its dotted name …
  businessContract: '/business/{contract}',
  businessContractRow: '/business/{contract}/{id}',
  // … or a section (the raw table), the older form.
  businessSection: '/business/{section}',
  businessRow: '/business/{section}/{id}',
  // gcr-api-clean routes/app-data.js: the per-app data space, scoped by the install token.
  appTable: '/app-data/{table}',
  appRow: '/app-data/{table}/{id}',
  // The install the token belongs to, and its settings.
  install: '/app-install',
  installSettings: '/app-install/settings',
  // What a visitor may read of a public install, and its append door.
  publicApp: '/public/apps/{installId}',
  publicSubmit: '/public/apps/{installId}/{table}',
})

/** The routes above that gcr-api-clean already serves. */
export const EXISTING_ROUTES = Object.freeze(Object.keys(DEFAULT_ROUTES))

export class AdapterError extends Error {
  constructor(message, { status = 0, body = null, path = '', errors = null } = {}) {
    super(message)
    this.name = 'AdapterError'
    this.status = status
    this.body = body
    this.path = path
    this.errors = errors
  }

  /** The route is not on the server yet (an unknown route answers 404 without a JSON error). */
  get notConnected() {
    if (this.body && typeof this.body === 'object' && (this.body.code === 'not_connected' || this.body.code === 'not_configured')) return true
    if ([404, 405, 501].includes(this.status)) return !this.body || typeof this.body !== 'object' || this.body.error === 'API route not found'
    return false
  }

  get forbidden() {
    return this.status === 403
  }
}

function fill(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    if (params[k] === undefined || params[k] === null || params[k] === '') throw new Error(`Route needs ${k}.`)
    return encodeURIComponent(String(params[k]))
  })
}

async function parse(res) {
  if (res.status === 204) return null
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function client({ baseUrl, getToken, fetch: fetchImpl, timeoutMs }) {
  const doFetch = fetchImpl || globalThis.fetch
  if (typeof doFetch !== 'function') throw new Error('No fetch available; pass one in.')
  const base = String(baseUrl ?? '').replace(/\/+$/, '')

  return async function request(method, path, { body, query } = {}) {
    const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString() : ''
    const url = `${base}${path}${qs ? `?${qs}` : ''}`
    const send = async (force) => {
      const headers = { Accept: 'application/json' }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      if (getToken) {
        const token = await getToken({ force })
        if (token) headers.Authorization = `Bearer ${token}`
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      const timer = controller && timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null
      try {
        return await doFetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller?.signal })
      } finally {
        if (timer) clearTimeout(timer)
      }
    }
    let res
    try {
      res = await send(false)
      // A token can expire between issue and use; one fresh try before believing a 401.
      if (res.status === 401 && getToken) res = await send(true)
    } catch (err) {
      throw new AdapterError('Could not reach the business data server.', { status: 0, path, body: { cause: String(err?.message || err) } })
    }
    const data = await parse(res)
    if (!res.ok) {
      const message = data && typeof data === 'object' && typeof (data.error || data.message) === 'string' ? data.error || data.message : `Request failed (${res.status})`
      throw new AdapterError(message, { status: res.status, body: data, path })
    }
    return data
  }
}

function sourceOf(manifest, key) {
  const source = manifest?.ui?.sources?.[key]
  if (!source) throw new AdapterError(`Unknown source "${key}".`)
  return source
}

/** The binding a business source resolves through, or null (older section form, or an app source). */
function bindingOf(manifest, source) {
  if (!source || source.from !== 'business' || source.binding === undefined) return null
  const binding = manifest?.bindings?.[source.binding]
  if (!binding) throw new AdapterError(`Source names unknown binding "${source.binding}".`)
  return binding
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** A row from the server (column names) as the manifest sees it (field keys). */
function rowToFields(binding, row) {
  const map = binding && isObj(binding.fieldMap) ? binding.fieldMap : null
  if (!map || !isObj(row)) return row
  const out = { ...row }
  for (const [field, column] of Object.entries(map)) {
    if (field === column || !(column in out)) continue
    out[field] = out[column]
    delete out[column]
  }
  return out
}

/** Values from a form (field keys) as the server stores them (column names). */
function valuesToColumns(binding, values) {
  const map = binding && isObj(binding.fieldMap) ? binding.fieldMap : null
  if (!map || !isObj(values)) return values
  const out = {}
  for (const [k, v] of Object.entries(values)) out[map[k] || k] = v
  return out
}

/** The bindings ui.format reads from the business, by binding key. */
function formatBindings(manifest) {
  const fmt = manifest?.ui?.format
  const out = {}
  if (!isObj(fmt)) return out
  for (const ref of Object.values(fmt)) {
    if (isObj(ref) && typeof ref.binding === 'string' && manifest?.bindings?.[ref.binding]) out[ref.binding] = manifest.bindings[ref.binding]
  }
  return out
}

/** A contract read as one value: { value }, or the first row's column named like the contract's last segment. */
function valueFrom(contract, body) {
  if (isObj(body) && body.value !== undefined && body.value !== null) return body.value
  const rows = rowsFrom(body)
  const leaf = String(contract).split('.').pop()
  const first = rows[0]
  if (isObj(first)) {
    if (first[leaf] !== undefined && first[leaf] !== null) return first[leaf]
    if (first.value !== undefined && first.value !== null) return first.value
  }
  return undefined
}

function rowsFrom(body) {
  if (Array.isArray(body)) return body
  if (body && Array.isArray(body.rows)) return body.rows
  return []
}

function rowFrom(body) {
  return body && typeof body === 'object' && body.row ? body.row : body
}

/**
 * Rows of every source the select fields being written draw their options
 * from (optionsFrom), so a write is checked against the same rows the
 * renderer showed. Rows already in hand (`given`) are used; the rest are read.
 * A field left blank references nothing, so its source is not read.
 */
async function lookupData(source, values, given, read) {
  const data = { ...(given || {}) }
  const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
  const needed = new Set(
    (source.fields || [])
      .filter((f) => f.optionsFrom && f.optionsFrom.source && !blank(values?.[f.key]))
      .map((f) => f.optionsFrom.source),
  )
  await Promise.all([...needed].filter((k) => !Array.isArray(data[k])).map(async (k) => { data[k] = await read(k) }))
  return data
}

/**
 * The owner-side adapter: an installed app, acting with its install token.
 *
 * @param {{ baseUrl: string, getToken: (o: { force: boolean }) => Promise<string>, fetch?: Function, routes?: object, timeoutMs?: number }} config
 */
export function createGcrAdapter(config) {
  const routes = { ...DEFAULT_ROUTES, ...(config.routes || {}) }
  const request = client({ timeoutMs: 30000, ...config })

  const pathFor = (manifest, source, id) => {
    if (source.from !== 'business') return fill(id === undefined ? routes.appTable : routes.appRow, { table: source.table, id })
    const binding = bindingOf(manifest, source)
    if (binding) return fill(id === undefined ? routes.businessContract : routes.businessContractRow, { contract: binding.contract, id })
    return fill(id === undefined ? routes.businessSection : routes.businessRow, { section: source.section, id })
  }
  const contractPath = (contract) => fill(routes.businessContract, { contract })

  const adapter = {
    routes,

    /** The install this token belongs to: { installId, itemKey, version, settings, granted }. */
    async install() {
      return request('GET', routes.install)
    },

    async list(manifest, key) {
      const source = sourceOf(manifest, key)
      const binding = bindingOf(manifest, source)
      const rows = rowsFrom(await request('GET', pathFor(manifest, source), { query: source.limit ? { limit: source.limit } : undefined }))
      return binding ? rows.map((r) => rowToFields(binding, r)) : rows
    },

    /** One value of the business, through a binding to a business.* contract (ui.format). */
    async businessValue(manifest, bindingKey) {
      const binding = manifest?.bindings?.[bindingKey]
      if (!binding) throw new AdapterError(`Unknown binding "${bindingKey}".`)
      return valueFrom(binding.contract, await request('GET', contractPath(binding.contract)))
    },

    /**
     * Everything a surface needs: settings, granted permissions and rows of
     * every source it reads. A source that cannot be read is reported in
     * `errors` and left empty; it does not take the screen down.
     */
    async load(manifest, which = 'owner') {
      let install = null
      let installError = null
      try {
        install = await adapter.install()
      } catch (err) {
        installError = err
      }
      const data = {}
      const business = {}
      const errors = {}
      await Promise.all([
        ...sourcesFor(manifest, which).map(async (key) => {
          try {
            data[key] = await adapter.list(manifest, key)
          } catch (err) {
            data[key] = []
            errors[key] = err
          }
        }),
        ...Object.keys(formatBindings(manifest)).map(async (key) => {
          try {
            const value = await adapter.businessValue(manifest, key)
            if (value !== undefined) business[key] = value
          } catch (err) {
            errors[key] = err
          }
        }),
      ])
      return {
        settings: install?.settings ?? {},
        granted: Array.isArray(install?.granted) ? install.granted : undefined,
        data,
        business,
        errors,
        installError,
      }
    },

    async create(manifest, key, values, { rows, data } = {}) {
      const source = sourceOf(manifest, key)
      const checked = checkRecord(manifest, key, values, { data: await lookupData(source, values, data, (k) => adapter.list(manifest, k)) })
      if (!checked.ok) throw new AdapterError('Some fields need attention.', { status: 422, errors: checked.errors })
      const body = { ...checked.data }
      if (source.sortable && source.order && rows) {
        body[source.order] = rows.reduce((max, r) => Math.max(max, Number(r[source.order]) || 0), 0) + 1
      }
      const binding = bindingOf(manifest, source)
      return rowToFields(binding, rowFrom(await request('POST', pathFor(manifest, source), { body: valuesToColumns(binding, body) })))
    },

    /** A PATCH: only the fields in `values` are checked and sent; the rest of the row is untouched. */
    async update(manifest, key, id, values, { data } = {}) {
      const source = sourceOf(manifest, key)
      const checked = checkRecord(manifest, key, values, { partial: true, data: await lookupData(source, values, data, (k) => adapter.list(manifest, k)) })
      if (!checked.ok) throw new AdapterError('Some fields need attention.', { status: 422, errors: checked.errors })
      const binding = bindingOf(manifest, source)
      return rowToFields(binding, rowFrom(await request('PATCH', pathFor(manifest, source, id), { body: valuesToColumns(binding, checked.data) })))
    },

    async remove(manifest, key, id) {
      const source = sourceOf(manifest, key)
      await request('DELETE', pathFor(manifest, source, id))
      return true
    },

    /** Swap a row with its neighbour by exchanging their order values (two PATCHes). */
    async move(manifest, key, rows, id, direction) {
      const source = sourceOf(manifest, key)
      if (!source.sortable || !source.order) throw new AdapterError(`Source "${key}" cannot be reordered.`)
      const list = [...rows].sort((a, b) => (Number(a[source.order]) || 0) - (Number(b[source.order]) || 0))
      const index = list.findIndex((r) => String(r.id) === String(id))
      const other = list[direction === 'up' ? index - 1 : index + 1]
      if (index < 0 || !other) return false
      const mine = list[index]
      // Equal or missing order values would swap to the same thing; use positions.
      const a = Number(mine[source.order])
      const b = Number(other[source.order])
      const [newMine, newOther] = Number.isFinite(a) && Number.isFinite(b) && a !== b ? [b, a] : direction === 'up' ? [index - 1, index] : [index + 1, index]
      const binding = bindingOf(manifest, source)
      await request('PATCH', pathFor(manifest, source, mine.id), { body: valuesToColumns(binding, { [source.order]: newMine }) })
      await request('PATCH', pathFor(manifest, source, other.id), { body: valuesToColumns(binding, { [source.order]: newOther }) })
      return true
    },

    /** Saves only the keys the manifest declares (the store's configKeys rule). */
    async saveSettings(manifest, values) {
      const keys = new Set(configKeys(manifest))
      const body = {}
      for (const [k, v] of Object.entries(values || {})) if (keys.has(k)) body[k] = v
      const res = await request('PUT', routes.installSettings, { body: { settings: body } })
      return res?.settings ?? body
    },
  }
  return adapter
}

/**
 * The visitor-side adapter: a public install, no token. It can read only what
 * the install shows publicly and append only to tables declared public
 * "append" — gcr-api-clean enforces both; the engine checks first.
 *
 * @param {{ baseUrl: string, installId: string, fetch?: Function, routes?: object, timeoutMs?: number }} config
 */
export function createPublicAdapter(config) {
  const routes = { ...DEFAULT_ROUTES, ...(config.routes || {}) }
  const request = client({ timeoutMs: 15000, ...config, getToken: null })
  const pub = {
    routes,
    /**
     * One read: settings, the public sources' rows and the business values of
     * format bindings — gcr-api-clean resolves bound sources to their contracts.
     * With the manifest given, bound rows come back under its field keys.
     */
    async load(manifest) {
      const body = await request('GET', fill(routes.publicApp, { installId: config.installId }))
      const data = { ...(body?.data ?? {}) }
      const m = manifest || body?.manifest
      for (const [key, source] of Object.entries(m?.ui?.sources || {})) {
        const binding = source?.from === 'business' && source.binding !== undefined ? m?.bindings?.[source.binding] : null
        if (binding && Array.isArray(data[key])) data[key] = data[key].map((r) => rowToFields(binding, r))
      }
      return { settings: body?.settings ?? {}, data, business: isObj(body?.business) ? body.business : {}, manifest: body?.manifest, errors: {} }
    },
    async submit(manifest, key, values, { data } = {}) {
      const source = sourceOf(manifest, key)
      // A visitor writes into the app's own append table, or — through a
      // read-write binding — into the business (a lead, a request). Either way
      // the path names the source key; gcr-api-clean resolves it through the
      // install's manifest and the install's permissions.
      const binding = bindingOf(manifest, source)
      if (source.from !== 'app' && !binding) throw new AdapterError('Visitors can only add to an app’s own tables.')
      const access = binding ? binding.access : manifest?.data?.tables?.[source.table]?.public || 'none'
      if (!(binding ? access === 'read-write' : access.includes('append'))) throw new AdapterError('This form is not open to visitors.')
      // Option sources a visitor may see all come back from one public read.
      let loaded = null
      const read = async (k) => {
        loaded = loaded || (await pub.load(manifest))
        return Array.isArray(loaded.data?.[k]) ? loaded.data[k] : []
      }
      const checked = checkRecord(manifest, key, values, { visitor: true, data: await lookupData(source, values, data, read) })
      if (!checked.ok) throw new AdapterError('Some fields need attention.', { status: 422, errors: checked.errors })
      const segment = binding ? key : source.table
      return rowToFields(binding, rowFrom(await request('POST', fill(routes.publicSubmit, { installId: config.installId, table: segment }), { body: valuesToColumns(binding, checked.data) })))
    },
  }
  return pub
}
