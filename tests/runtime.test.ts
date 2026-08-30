import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateOwnerRecord, validatePublicRecord } from '../src/lib/runtime/values.ts'
import { safeParseManifest } from '../src/lib/modules/spec.ts'
import songRequest from '../src/modules/song-request/manifest.ts'
import linkHub from '../src/modules/link-hub/manifest.ts'
import qrMenu from '../src/modules/qr-menu/manifest.ts'

const requests = songRequest.collections.requests
const links = linkHub.collections.links

test('every shipped manifest satisfies the spec', () => {
  for (const manifest of [qrMenu, songRequest, linkHub]) {
    const result = safeParseManifest(manifest)
    assert.equal(result.success, true, `${(manifest as { id: string }).id} failed validation`)
  }
})

test('a manifest with a public collection but no public_page permission is rejected', () => {
  const result = safeParseManifest({
    ...linkHub,
    permissions: ['store_records'],
  })

  assert.equal(result.success, false)
})

test('a manifest referencing an unknown field is rejected', () => {
  const result = safeParseManifest({
    ...linkHub,
    collections: {
      links: { ...links, titleField: 'does_not_exist' },
    },
  })

  assert.equal(result.success, false)
})

test('a visitor cannot set an owner-only field', () => {
  const result = validatePublicRecord(requests, {
    song: 'Blue Monday',
    status: 'played',
  })

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.data.status, 'pending')
})

test('undeclared keys are dropped rather than stored', () => {
  const result = validatePublicRecord(requests, {
    song: 'Test',
    is_admin: true,
    owner_id: 'someone-else',
  })

  assert.equal(result.ok, true)
  assert.equal(result.ok && 'is_admin' in result.data, false)
  assert.equal(result.ok && 'owner_id' in result.data, false)
})

test('required fields are enforced', () => {
  assert.equal(validatePublicRecord(requests, { artist: 'New Order' }).ok, false)
})

test('select fields only accept declared options', () => {
  assert.equal(validateOwnerRecord(requests, { song: 'x', status: 'superuser' }).ok, false)
})

test('non-http url schemes are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd']) {
    assert.equal(
      validateOwnerRecord(links, { label: 'Click', url }).ok,
      false,
      `${url} should be rejected`,
    )
  }
})

test('a bare domain is upgraded to https', () => {
  const result = validateOwnerRecord(links, { label: 'Site', url: 'example.com/menu' })

  assert.equal(result.ok, true)
  assert.equal(result.ok && String(result.data.url).startsWith('https://'), true)
})

test('over-length text is rejected', () => {
  assert.equal(
    validateOwnerRecord(links, { label: 'x'.repeat(500), url: 'https://a.com' }).ok,
    false,
  )
})

test('money values are rounded to two places', () => {
  const result = validateOwnerRecord(qrMenu.collections.items, {
    name: 'Soup',
    price: '12.999',
    section: 'starters',
  })

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.data.price, 13)
})

test('money is grouped, and shows cents only when there are any', async () => {
  const { formatMoney } = await import('../src/lib/runtime/format.ts')

  assert.equal(formatMoney(540000), '$540,000')
  assert.equal(formatMoney(2400), '$2,400')
  assert.equal(formatMoney(12.5), '$12.50')
  assert.equal(formatMoney(9.99, '£'), '£9.99')
  assert.equal(formatMoney(0), '$0')
})
