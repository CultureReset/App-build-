import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Manifest } from '@nextgent/app-engine'
import { shippedManifests, shippedPublishers } from '../src/lib/engine/starters.ts'
import { publisherKey, publisherFromSession, checkPublishTarget, sameDataModel } from '../src/lib/engine/publisher.ts'

/**
 * DECISIONS #43: builder-published apps carry the operator's publisher
 * prefix, never the shipped apps' one; and a new version is refused when the
 * item already in the store has a different data model.
 */
const shipped = shippedManifests()
const reserved = shippedPublishers()

test('the reserved publishers are read from the shipped manifests, not written here', () => {
  assert.deepEqual(reserved, [...new Set(shipped.map((s) => s.manifest.publisher))].sort())
  assert.ok(reserved.length >= 1)
})

test('the publisher key is the configured one, else the operator from the session; a reserved one is refused', () => {
  const session = { user: { id: 'u1', email: 'ana.ops@example.test', name: 'Ana Ops' } }
  assert.equal(publisherFromSession(session), 'ana-ops')
  assert.equal(publisherFromSession({ user: { id: 'u1', email: 'ana.ops@example.test', name: null } }), 'ana-ops')
  assert.equal(publisherFromSession({ user: { id: 'u1', email: null, name: null } }), null)
  assert.equal(publisherFromSession(null), null)
  assert.deepEqual(publisherKey({ configured: 'acme-shop', session, reserved }), { ok: true, publisher: 'acme-shop' })
  assert.deepEqual(publisherKey({ configured: '', session, reserved }), { ok: true, publisher: 'ana-ops' })
  const refused = publisherKey({ configured: reserved[0], session, reserved })
  assert.equal(refused.ok, false)
  assert.match(refused.ok ? '' : refused.error, /shipped apps/)
  assert.equal(publisherKey({ configured: '', session: null, reserved }).ok, false)
})

test('the same data model is tables and bindings, nothing else', () => {
  const faq = shipped.find((s) => s.dir === 'faq')!.manifest
  assert.equal(sameDataModel(faq, { ...faq, name: 'Renamed', version: '2.0.0', ui: undefined } as Manifest), true)
  const widened = structuredClone(faq)
  if (widened.data?.tables) Object.values(widened.data.tables)[0].columns.extra = { type: 'text' }
  assert.equal(sameDataModel(faq, widened), false)
  const menu = shipped.find((s) => s.dir === 'qr-menu')!.manifest
  const rebound = structuredClone(menu)
  Object.values(rebound.bindings!)[0].access = 'read'
  assert.equal(sameDataModel(menu, rebound), false)
})

test('publishing onto an existing key is refused when the stored manifest has a different data model', () => {
  const menu = shipped.find((s) => s.dir === 'qr-menu')!.manifest
  const listing = [
    { id: 'item-1', key: menu.id, versions: [{ version: '1.0.0', createdAt: '2026-01-01', payload: { app: menu } }] },
    { id: 'item-2', key: 'other-app', versions: [] },
  ]
  assert.deepEqual(checkPublishTarget(listing, { ...menu, version: '1.1.0' }), { ok: true, existing: { id: 'item-1', key: menu.id } })
  assert.deepEqual(checkPublishTarget(listing, { ...menu, id: 'brand-new' }), { ok: true, existing: null })
  const different = structuredClone(menu)
  different.bindings = { menu_items: { contract: 'menu.items', access: 'read' } }
  const refused = checkPublishTarget(listing, different)
  assert.equal(refused.ok, false)
  assert.match(refused.ok ? '' : refused.error, /different data model/)
  // The newest version is the one compared.
  const newer = [{ id: 'item-1', key: menu.id, versions: [
    { version: '1.0.0', createdAt: '2026-01-01', payload: { app: menu } },
    { version: '2.0.0', createdAt: '2026-02-01', payload: { app: different } },
  ] }]
  assert.equal(checkPublishTarget(newer, { ...menu, version: '2.1.0' }).ok, false)
  assert.equal(checkPublishTarget(newer, { ...different, version: '2.1.0' }).ok, true)
  // A listing the store did not answer is not a licence to publish.
  assert.equal(checkPublishTarget(null, menu).ok, false)
})
