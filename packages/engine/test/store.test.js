import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toStorePublication, publishToStore } from '../src/index.js'
import { sampleManifest } from './fixtures.js'

test('a manifest becomes a Paperclip item and release', () => {
  const pub = toStorePublication(sampleManifest(), { channel: 'fast', changelog: 'First' })
  assert.equal(pub.ok, true)
  assert.deepEqual(pub.item, { key: 'test-sample', kind: 'app', name: 'Sample', summary: 'Exercises every view.' })
  assert.equal(pub.version.version, '1.2.3')
  assert.equal(pub.version.channel, 'fast')
  assert.deepEqual(pub.version.payload.nextgent, {
    kind: 'app',
    permissions: [
      { permission: 'things:read', reason: 'Shows the business things.' },
      { permission: 'things:write', reason: 'Edits the business things.', optional: true },
    ],
  })
  assert.equal(pub.version.payload.app.id, 'test-sample')
})

test('an optional permission stays optional in the release', () => {
  const pub = toStorePublication(sampleManifest())
  assert.equal(pub.ok, true)
  const byId = Object.fromEntries(pub.version.payload.nextgent.permissions.map((p) => [p.permission, p]))
  assert.equal(byId['things:write'].optional, true, 'optional: true is kept')
  assert.equal('optional' in byId['things:read'], false, 'a permission declared without optional gains no key')
})

test('an invalid manifest is not published', () => {
  const pub = toStorePublication({ ...sampleManifest(), id: 'Bad' })
  assert.equal(pub.ok, false)
  assert.ok(pub.errors.length)
})

test('publish creates the item, or finds it, then adds the version', async () => {
  const calls = []
  const fetch = async (url, init) => {
    calls.push([init.method, url, init.credentials])
    if (init.method === 'POST' && url.endsWith('/items')) return new Response(JSON.stringify({ error: 'exists' }), { status: 409 })
    if (init.method === 'GET') return new Response(JSON.stringify([{ id: 'item-1', key: 'test-sample' }]), { status: 200 })
    return new Response(JSON.stringify({ version: { id: 'v1' } }), { status: 201 })
  }
  const pub = toStorePublication(sampleManifest())
  const out = await publishToStore(pub, { baseUrl: 'https://paperclip.example.test/', fetch, credentials: 'include' })
  assert.equal(out.item.id, 'item-1')
  assert.deepEqual(calls.map((c) => c[0] + ' ' + c[1].replace('https://paperclip.example.test', '')), [
    'POST /api/store/admin/items',
    'GET /api/store/admin/items',
    'POST /api/store/admin/items/item-1/versions',
  ])
  assert.ok(calls.every((c) => c[2] === 'include'))
})

test('a refused publish says why', async () => {
  const fetch = async () => new Response(JSON.stringify({ error: 'Instance admin required' }), { status: 403 })
  await assert.rejects(publishToStore(toStorePublication(sampleManifest()), { baseUrl: 'https://p.example.test', fetch }), /Instance admin required/)
  await assert.rejects(publishToStore(toStorePublication(sampleManifest()), { baseUrl: '' }), /No store address/)
})
