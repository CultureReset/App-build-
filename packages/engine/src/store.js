// From a manifest to a Paperclip store release (nextgent/foundation:
// server/src/routes/store.ts). Publishing is two calls an instance admin makes:
//
//   POST {paperclip}/api/store/admin/items                 { key, kind, name, summary?, description?, iconUrl? }
//   POST {paperclip}/api/store/admin/items/:itemId/versions { version, channel, advisoryType, required, changelog?, payload }
//
// payload.nextgent is the section Paperclip reads for consent and for the
// install token gcr-api-clean issues: { kind: 'app', permissions: [{ permission, reason, optional? }] }.
// payload.app is the whole manifest, which the engine renders after install.

import { validateManifest } from './manifest.js'

/** Item kind for an app (CONTRACT §4: agent | app | automation). */
export const APP_KIND = 'app'

function isHttpUrl(value) {
  try {
    const u = new URL(String(value))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * @param {object} manifest
 * @param {{ kind?: string, channel?: string, advisoryType?: string, required?: boolean, changelog?: string }} [release]
 * @returns {{ ok: true, item: object, version: object } | { ok: false, errors: object[] }}
 */
export function toStorePublication(manifest, release = {}) {
  const kind = release.kind || APP_KIND
  const checked = validateManifest(manifest, {
    item: { key: manifest?.id, kind: APP_KIND, name: manifest?.name, publisher: manifest?.publisher },
    semver: manifest?.version,
  })
  if (!checked.ok) return { ok: false, errors: checked.errors }
  const m = checked.manifest
  const item = { key: m.id, kind, name: m.name }
  if (m.summary) item.summary = m.summary
  if (m.description) item.description = m.description
  if (isHttpUrl(m.icon)) item.iconUrl = m.icon

  const version = {
    version: m.version,
    payload: {
      nextgent: {
        kind: APP_KIND,
        permissions: (m.permissions || []).map((p) => ({ permission: p.id, reason: p.reason, ...(p.optional !== undefined ? { optional: p.optional } : {}) })),
      },
      app: m,
    },
  }
  for (const k of ['channel', 'advisoryType', 'required', 'changelog']) if (release[k] !== undefined) version[k] = release[k]
  return { ok: true, item, version }
}

/**
 * Publish through Paperclip's admin API. The caller supplies how to be
 * authorised (an instance admin's session cookie via credentials: 'include',
 * or a header); the engine holds no credential of its own.
 *
 * @param {{ item: object, version: object }} publication
 * @param {{ baseUrl: string, fetch?: Function, headers?: object, credentials?: string }} target
 */
export async function publishToStore(publication, target) {
  const doFetch = target.fetch || globalThis.fetch
  const base = String(target.baseUrl || '').replace(/\/+$/, '')
  if (!base) throw new Error('No store address configured.')
  const call = async (method, path, body) => {
    const res = await doFetch(`${base}${path}`, {
      method,
      credentials: target.credentials,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(target.headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text().catch(() => '')
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: res.status, ok: res.ok, data }
  }
  const message = (r) => (r.data && typeof r.data === 'object' && (r.data.error || r.data.message)) || `Store answered ${r.status}`

  let item
  const created = await call('POST', '/api/store/admin/items', publication.item)
  if (created.ok) item = created.data
  else if (created.status === 409) {
    // Already listed: release a new version of the existing item.
    const all = await call('GET', '/api/store/admin/items')
    if (!all.ok) throw new Error(message(all))
    item = (Array.isArray(all.data) ? all.data : []).find((i) => i.key === publication.item.key)
    if (!item) throw new Error(message(created))
  } else throw new Error(message(created))

  const released = await call('POST', `/api/store/admin/items/${encodeURIComponent(item.id)}/versions`, publication.version)
  if (!released.ok) throw new Error(message(released))
  return { item, release: released.data }
}
