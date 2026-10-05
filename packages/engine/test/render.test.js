import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderOwner, renderPublic, renderSurface, sourcesFor, surfacesOf, checkBlocks, walkBlocks, checkRecord, embedSrc, BLOCK_TYPES } from '../src/index.js'
import { sampleManifest, sampleData, EMBEDS } from './fixtures.js'

const NOW = Date.parse('2026-01-03T00:30:00Z')
const all = (blocks) => [...walkBlocks(blocks)]
const json = (x) => JSON.stringify(x)

test('owner render is valid blocks and covers each owner view', () => {
  const blocks = renderOwner(sampleManifest(), { currency: 'EUR' }, sampleData(), {}, { now: NOW, locale: 'en-US' })
  assert.deepEqual(checkBlocks(blocks), [])
  const titles = blocks.map((b) => b.title)
  assert.deepEqual(titles, ['Notes', 'Things', 'Settings'])
})

test('owner sees owner-only fields and hidden rows; visitors never do', () => {
  const owner = json(renderOwner(sampleManifest(), {}, sampleData()))
  assert.ok(owner.includes('Hidden'))
  const pub = json(renderPublic(sampleManifest(), {}, sampleData(), {}, { embeds: EMBEDS }))
  assert.ok(!pub.includes('private-value'))
  assert.ok(!pub.includes('"Hidden"'))
  assert.ok(!pub.includes('nope'))
})

test('write controls follow granted permissions for business sources', () => {
  const manifest = sampleManifest()
  const readOnly = renderOwner(manifest, {}, sampleData(), { granted: ['things:read'] })
  const things = readOnly.find((b) => b.title === 'Things')
  assert.ok(!all(things.blocks).some((b) => b.type === 'button'))
  assert.ok(all(things.blocks).some((b) => b.type === 'notice'))
  const full = renderOwner(manifest, {}, sampleData(), { granted: ['things:read', 'things:write'] })
  assert.ok(all(full.find((b) => b.title === 'Things').blocks).some((b) => b.type === 'button'))
  const none = renderOwner(manifest, {}, sampleData(), { granted: [] })
  assert.equal(none.find((b) => b.title === 'Things').blocks[0].tone, 'warning')
})

test('app-owned records are always the app’s to edit; rows carry edit, delete and move', () => {
  const blocks = renderOwner(sampleManifest(), {}, sampleData(), { granted: [] })
  const notes = blocks.find((b) => b.title === 'Notes')
  const tables = all(notes.blocks).filter((b) => b.type === 'table')
  const types = tables.flatMap((t) => t.rows.flatMap((r) => r.actions.map((a) => a.action.type)))
  for (const t of ['record.move', 'view.edit', 'record.delete']) assert.ok(types.includes(t), t)
})

test('editing opens a form with the row’s values; new opens a blank one', () => {
  const edit = renderOwner(sampleManifest(), {}, sampleData(), { editing: { source: 'notes', id: 'n1' } })
  const form = all(edit).find((b) => b.type === 'form' && b.id === 'notes:n1')
  assert.equal(form.values.title, 'Hello')
  assert.equal(form.submit.action.type, 'record.update')
  const add = renderOwner(sampleManifest(), {}, sampleData(), { editing: { source: 'notes', id: null } })
  const blank = all(add).find((b) => b.id === 'notes:new')
  assert.equal(blank.values.shown, true)
  assert.equal(blank.submit.action.type, 'record.create')
})

test('grouping uses the select options, and options drawn from another source', () => {
  const blocks = renderOwner(sampleManifest(), {}, sampleData(), {})
  const things = blocks.find((b) => b.title === 'Things')
  const groupTitles = things.blocks.filter((b) => b.type === 'section').map((b) => b.title)
  assert.deepEqual(groupTitles, ['First', 'Second', 'Other'])
})

test('sortable sources render in their order column', () => {
  const blocks = renderOwner(sampleManifest(), {}, { ...sampleData(), groups: [] }, {})
  const things = blocks.find((b) => b.title === 'Things')
  const rows = all(things.blocks).filter((b) => b.type === 'table').flatMap((t) => t.rows.map((r) => r.id))
  assert.deepEqual(rows, ['t2', 't1', 't3'])
})

test('settings form never echoes a secret', () => {
  const blocks = renderOwner(sampleManifest(), { api_key: 'sk-hidden' }, sampleData())
  const form = all(blocks).find((b) => b.id === 'settings')
  assert.equal(form.values.api_key, '')
  assert.equal(form.fields.find((f) => f.key === 'api_key').type, 'secret')
  assert.ok(!json(blocks).includes('sk-hidden'))
})

test('public render: every view type produces valid blocks', () => {
  const blocks = renderPublic(sampleManifest(), { currency: 'EUR' }, sampleData(), {}, { embeds: EMBEDS, now: NOW, locale: 'en-US' })
  assert.deepEqual(checkBlocks(blocks), [])
  const types = new Set(all(blocks).map((b) => b.type))
  for (const t of ['list', 'buttons', 'images', 'details', 'embed', 'form', 'text']) assert.ok(types.has(t), t)
  for (const t of types) assert.ok(BLOCK_TYPES.includes(t))
})

test('public render formats money with the install’s currency and locale', () => {
  const blocks = renderPublic(sampleManifest(), { currency: 'EUR' }, sampleData(), {}, { locale: 'en-US' })
  const values = all(blocks).filter((b) => b.type === 'list').flatMap((b) => b.items.map((i) => i.value)).filter(Boolean)
  assert.ok(values.includes('€12.50'))
  assert.ok(values.includes('€1,000'))
  const symbol = renderPublic(sampleManifest(), { currency: '£' }, sampleData(), {}, { locale: 'en-GB' })
  assert.ok(json(symbol).includes('£12.50'))
})

test('unsafe links and images are dropped, text is kept as data', () => {
  const blocks = renderPublic(sampleManifest(), {}, sampleData(), {}, { embeds: EMBEDS })
  const text = json(blocks)
  assert.ok(!text.includes('javascript:'))
  assert.ok(!text.includes('data:image'))
  assert.ok(text.includes('<script>alert(1)</script>'), 'raw text stays text; drawing escapes it')
})

test('embeds only come from configured providers', () => {
  assert.equal(embedSrc('https://video.example.test/watch?v=abcdef123', EMBEDS), 'https://player.example.test/embed/abcdef123')
  assert.equal(embedSrc('https://video.example.test/watch?v=BAD!', EMBEDS), null)
  assert.equal(embedSrc('https://other.example.test/watch?v=abcdef123', EMBEDS), null)
  assert.equal(embedSrc('https://video.example.test/watch?v=abcdef123', undefined), null)
  const blocks = renderPublic(sampleManifest(), {}, sampleData())
  assert.ok(!all(blocks).some((b) => b.type === 'embed'))
})

test('icons come from the select option, not the engine', () => {
  const blocks = renderPublic(sampleManifest(), {}, sampleData())
  const buttons = all(blocks).find((b) => b.type === 'buttons')
  assert.equal(buttons.items[0].icon, 'α')
  assert.equal(buttons.items[0].label, 'Alpha')
})

test('a closed form shows the closed text; a sent one shows thanks', () => {
  const closed = renderPublic(sampleManifest(), { open: false }, sampleData())
  assert.ok(!all(closed).some((b) => b.type === 'form'))
  const sent = renderPublic(sampleManifest(), {}, sampleData(), { submitted: { 'notes:visitor': true } })
  assert.ok(all(sent).some((b) => b.type === 'notice' && b.tone === 'success'))
  const form = all(sent).find((b) => b.type === 'form')
  assert.ok(!form.fields.some((f) => f.key === 'secret_flag'))
  assert.equal(form.intro, 'Say hello.')
})

test('feed shows newest first with relative time', () => {
  const blocks = renderPublic(sampleManifest(), {}, sampleData(), {}, { now: NOW })
  const feed = all(blocks).find((b) => b.type === 'list' && b.style === 'feed')
  assert.equal(feed.items[0].id, 'n3')
  assert.equal(feed.items[0].time, '30m ago')
})

test('copy can be replaced by the screen', () => {
  const blocks = renderOwner(sampleManifest(), {}, sampleData(), {}, { copy: { edit: 'Bearbeiten' } })
  assert.ok(json(blocks).includes('Bearbeiten'))
})

test('renderSurface draws one surface; surfacesOf and sourcesFor describe the manifest', () => {
  const tv = renderSurface(sampleManifest(), 'tv', {}, sampleData())
  assert.deepEqual(checkBlocks(tv), [])
  assert.equal(all(tv).find((b) => b.type === 'list').style, 'grid')
  assert.deepEqual(renderSurface(sampleManifest(), 'nope', {}, {}), [])
  assert.deepEqual(surfacesOf(sampleManifest()), { owner: ['owner'], public: ['public'], other: ['tv'] })
  assert.deepEqual(sourcesFor(sampleManifest(), 'owner').sort(), ['groups', 'notes', 'things'])
  assert.deepEqual(sourcesFor(sampleManifest(), 'tv'), ['notes'])
})

test('missing or odd data never throws', () => {
  for (const data of [undefined, {}, { notes: 'x' }, { notes: [null, 1, {}] }]) {
    assert.deepEqual(checkBlocks(renderPublic(sampleManifest(), undefined, data)), [])
    assert.deepEqual(checkBlocks(renderOwner(sampleManifest(), null, data)), [])
  }
})

test('checkRecord: same rules for owners and visitors, visitors lose owner-only fields', () => {
  const m = sampleManifest()
  const bad = checkRecord(m, 'notes', { title: '', link: 'javascript:x', kind: 'zzz' })
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.title && bad.errors.link && bad.errors.kind)
  const visitor = checkRecord(m, 'notes', { title: 'Hi', secret_flag: 'mine', extra: 'dropped' }, { visitor: true })
  assert.equal(visitor.ok, true)
  assert.equal(visitor.data.secret_flag, 'new')
  assert.ok(!('extra' in visitor.data))
  const ref = checkRecord(m, 'things', { name: 'X', group_id: 9 }, { data: sampleData() })
  assert.equal(ref.ok, false)
  assert.equal(checkRecord(m, 'things', { name: 'X', group_id: 2 }, { data: sampleData() }).ok, true)
})

test('an owner-only field never reaches a visitor through a default slot (source title)', () => {
  const m = sampleManifest()
  m.ui.sources.notes.title = 'secret_flag'
  // No explicit title binding: list, details, feed and links fall back to the source title.
  m.ui.views.public = [
    { type: 'list', source: 'notes' },
    { type: 'details', source: 'notes', fields: { body: 'body' } },
    { type: 'feed', source: 'notes' },
    { type: 'links', source: 'notes', fields: { link: 'link' } },
  ]
  const pub = json(renderPublic(m, {}, sampleData()))
  assert.ok(!pub.includes('private-value'), pub)
  // The owner still sees it.
  assert.ok(json(renderOwner(m, {}, sampleData())).includes('private-value'))
})

test('checkRecord: text in a number or money field is refused, not read as 0', () => {
  const m = sampleManifest()
  for (const raw of ['abc', '12abc', '-', '.', '1.2.3']) {
    const r = checkRecord(m, 'notes', { title: 'T', count: raw, amount: raw })
    assert.equal(r.ok, false, raw)
    assert.ok(r.errors.count && r.errors.amount, raw)
  }
  // The ways people type numbers still read.
  for (const [raw, want] of [['12', 12], [' 7 ', 7], ['1,000', 1000], ['€12.50', 12.5], ['-3', -3], [4, 4], ['.5', 0.5]]) {
    const r = checkRecord(m, 'notes', { title: 'T', count: raw })
    assert.equal(r.ok, true, String(raw))
    assert.equal(r.data.count, want)
  }
})

test('a format binding takes its currency from the business values the adapter loaded', () => {
  const m = sampleManifest()
  m.permissions.push({ id: 'business:read', reason: 'Reads the business currency.' })
  m.bindings = { currency: { contract: 'business.currency', access: 'read' } }
  m.ui.format = { currency: { binding: 'currency' } }
  const blocks = renderPublic(m, { currency: 'EUR' }, sampleData(), {}, { locale: 'en-US', business: { currency: 'GBP' } })
  const text = JSON.stringify(blocks)
  assert.ok(text.includes('£12.50'), 'the business currency wins over the install setting of the same name')
  assert.ok(!text.includes('€12.50'))
  const none = JSON.stringify(renderPublic(m, {}, sampleData(), {}, { locale: 'en-US' }))
  assert.ok(none.includes('12.5'), 'no business value: the number alone')
})
