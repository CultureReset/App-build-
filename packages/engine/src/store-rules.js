// The store's version rules, kept identical to gcr-api-clean's
// lib/storeManifest.js (prepareVersion, permissionIds, configKeys, SEMVER).
//
// They are reproduced here, not reinvented: same regular expression, same
// defaults, same messages. test/store-rules.test.js pins the behaviour, and
// when gcr-api-clean's copy changes this one has to change with it. The
// longer-term fix is one shared package both repos import (see README).

export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export function permissionIds(list) {
  if (!Array.isArray(list)) return []
  const ids = list
    .map((p) => (typeof p === 'string' ? p : p && (p.id || p.name || p.key)))
    .filter((p) => typeof p === 'string' && p.trim())
    .map((p) => p.trim())
  return [...new Set(ids)].sort()
}

/** The setting keys a version declares; anything else a business sends is dropped. */
export function configKeys(manifest) {
  const config = manifest?.config
  if (Array.isArray(config)) return config.map((c) => c && c.key).filter(Boolean)
  if (config && typeof config === 'object') {
    if (config.properties && typeof config.properties === 'object') return Object.keys(config.properties)
    return Object.keys(config)
  }
  return []
}

/**
 * @returns {{ ok: true, manifest: object, permissions: string[] } | { ok: false, error: string }}
 */
export function prepareVersion(item, { semver, manifest }) {
  if (typeof semver !== 'string' || !SEMVER.test(semver.trim())) {
    return { ok: false, error: 'semver must look like 1.2.3.' }
  }
  const v = semver.trim()
  if (manifest !== undefined && (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest))) {
    return { ok: false, error: 'manifest must be an object.' }
  }
  const m = { ...(manifest || {}) }
  if (m.version !== undefined && m.version !== v) {
    return { ok: false, error: `manifest.version (${m.version}) does not match ${v}.` }
  }
  if (item.kind === 'app') {
    m.schema_version = m.schema_version || 1
    m.id = m.id || item.key
    m.name = m.name || item.name
    m.publisher = m.publisher || item.publisher
    if (m.id !== item.key) return { ok: false, error: `manifest.id (${m.id}) must be the item key (${item.key}).` }
    if (!m.runtime || typeof m.runtime !== 'object') {
      return { ok: false, error: 'An app manifest needs a runtime (how its code runs), per app-manifest v1.' }
    }
  }
  m.version = v
  return { ok: true, manifest: m, permissions: permissionIds(m.permissions) }
}
