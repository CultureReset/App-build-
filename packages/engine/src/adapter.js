// Data access. The engine never holds a database client: every read and write
// goes to gcr-api-clean over HTTP with the install's token, and gcr-api-clean
// decides which business that is (from the token, never from the request) and
// what the token may touch (CONTRACT §6 permissions).
//
// Two kinds of source (manifest ui.sources):
//   business  the business's own data — /api/business/<section> (exists)
//   app       records the app keeps for itself, in its own data space behind
//             gcr-api-clean (plan §7) — /api/app-data/<table>
//
// `baseUrl` is wherever /api/* of gcr-api-clean is reachable from the caller:
// gcr-api-clean's own /api, or a screen's proxy (Play-user's /biz).

import { checkRecord, sourcesFor } from './render.js'
import { configKeys } from './store-rules.js'

export const DEFAULT_ROUTES = Object.freeze({
  // gcr-api-clean routes/business-data.js.
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

  const pathFor = (source, id) =>
    source.from === 'business'
      ? fill(id === undefined ? routes.businessSection : routes.businessRow, { section: source.section, id })
      : fill(id === undefined ? routes.appTable : routes.appRow, { table: source.table, id })

  const adapter = {
    routes,

    /** The install this token belongs to: { installId, itemKey, version, settings, granted }. */
    async install() {
      return request('GET', routes.install)
    },

    async list(manifest, key) {
      const source = sourceOf(manifest, key)
      return rowsFrom(await request('GET', pathFor(source), { query: source.limit ? { limit: source.limit } : undefined }))
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
      const errors = {}
      await Promise.all(
        sourcesFor(manifest, which).map(async (key) => {
          try {
            data[key] = await adapter.list(manifest, key)
          } catch (err) {
            data[key] = []
            errors[key] = err
          }
        }),
      )
      return {
        settings: install?.settings ?? {},
        granted: Array.isArray(install?.granted) ? install.granted : undefined,
        data,
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
      return rowFrom(await request('POST', pathFor(source), { body }))
    },

    async update(manifest, key, id, values, { data } = {}) {
      const source = sourceOf(manifest, key)
      const checked = checkRecord(manifest, key, values, { data: await lookupData(source, values, data, (k) => adapter.list(manifest, k)) })
      if (!checked.ok) throw new AdapterError('Some fields need attention.', { status: 422, errors: checked.errors })
      return rowFrom(await request('PATCH', pathFor(source, id), { body: checked.data }))
    },

    async remove(manifest, key, id) {
      const source = sourceOf(manifest, key)
      await request('DELETE', pathFor(source, id))
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
      await request('PATCH', pathFor(source, mine.id), { body: { [source.order]: newMine } })
      await request('PATCH', pathFor(source, other.id), { body: { [source.order]: newOther } })
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
    async load() {
      const body = await request('GET', fill(routes.publicApp, { installId: config.installId }))
      return { settings: body?.settings ?? {}, data: body?.data ?? {}, manifest: body?.manifest, errors: {} }
    },
    async submit(manifest, key, values, { data } = {}) {
      const source = sourceOf(manifest, key)
      if (source.from !== 'app') throw new AdapterError('Visitors can only add to an app’s own tables.')
      const access = manifest?.data?.tables?.[source.table]?.public || 'none'
      if (!access.includes('append')) throw new AdapterError('This form is not open to visitors.')
      // Option sources a visitor may see all come back from one public read.
      let loaded = null
      const read = async (k) => {
        loaded = loaded || (await pub.load())
        return Array.isArray(loaded.data?.[k]) ? loaded.data[k] : []
      }
      const checked = checkRecord(manifest, key, values, { visitor: true, data: await lookupData(source, values, data, read) })
      if (!checked.ok) throw new AdapterError('Some fields need attention.', { status: 422, errors: checked.errors })
      return rowFrom(await request('POST', fill(routes.publicSubmit, { installId: config.installId, table: source.table }), { body: checked.data }))
    },
  }
  return pub
}
