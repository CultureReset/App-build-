import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateManifest, parseManifest, permissionsOf, resourcesOf, resourceForContract, bindingPermissions, inboxTables, inboxBindings, CONTRACTS } from '../src/index.js'
import { sampleManifest } from './fixtures.js'

const errorsOf = (m, opts) => validateManifest(m, opts).errors.map((e) => `${e.path} ${e.message}`)
const has = (m, needle, opts) => errorsOf(m, opts).some((e) => e.includes(needle))

test('the sample manifest is valid', () => {
  const r = validateManifest(sampleManifest())
  assert.deepEqual(r.errors, [])
  assert.equal(r.ok, true)
})

test('v1: required fields', () => {
  for (const key of ['schema_version', 'id', 'name', 'version', 'publisher', 'runtime']) {
    const m = sampleManifest()
    delete m[key]
    assert.ok(has(m, `${key} is required`), key)
  }
})

test('v1: unknown top-level keys are refused', () => {
  assert.ok(has(sampleManifest({ extra: 1 }), 'extra is not an allowed property'))
})

test('v1: id, publisher, version, schema_version patterns', () => {
  assert.ok(has(sampleManifest({ id: 'with.dot' }), 'id must match'))
  assert.ok(has(sampleManifest({ publisher: 'Bad Name' }), 'publisher must match'))
  assert.ok(has(sampleManifest({ version: '1.0' }), 'version must match'))
  assert.ok(has(sampleManifest({ schema_version: 2 }), 'schema_version must be 1'))
  assert.ok(has(sampleManifest({ name: '' }), 'name must be at least 1'))
})

test('v1: runtime is one of hosted, service, engine', () => {
  assert.equal(validateManifest(sampleManifest({ runtime: { type: 'hosted', url: 'https://app.example.test' }, ui: undefined })).errors.filter((e) => !e.path.startsWith('ui')).length, 0)
  assert.ok(has(sampleManifest({ runtime: { type: 'hosted' } }), 'runtime.url is required'))
  assert.ok(has(sampleManifest({ runtime: { type: 'lambda' } }), 'runtime.type must be'))
  assert.ok(has(sampleManifest({ runtime: { type: 'service', base_url: 'ftp://x' } }), 'runtime.base_url must match'))
})

test('v1: surfaces, kinds and relative paths', () => {
  const m = sampleManifest()
  m.surfaces[0].kind = 'popup'
  m.surfaces[1].path = 'https://elsewhere.test/'
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('surfaces[0].kind must be one of')))
  assert.ok(errs.some((e) => e.includes('surfaces[1].path must match')))
})

test('permissions are resource:action with an honest reason', () => {
  const dotted = sampleManifest()
  dotted.permissions[0].id = 'things.read'
  assert.ok(has(dotted, "uses v1's dotted form"))
  const short = sampleManifest()
  short.permissions[0].reason = 'short'
  assert.ok(has(short, 'reason must be at least 8'))
  const dup = sampleManifest()
  dup.permissions.push({ ...dup.permissions[0] })
  assert.ok(has(dup, 'declared twice'))
})

test('v1: data tables, columns, public access', () => {
  const m = sampleManifest()
  m.data.tables.notes.columns.title.type = 'varchar'
  m.data.tables.notes.public = 'everyone'
  m.data.tables.Bad = { columns: { a: { type: 'text' } } }
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('columns.title.type must be one of')))
  assert.ok(errs.some((e) => e.includes('notes.public must be one of')))
  assert.ok(errs.some((e) => e.includes('data.tables.Bad')))
})

test('v1: config entries and pricing rules', () => {
  const m = sampleManifest()
  m.config.push({ key: 'Bad Key', label: 'x', type: 'colour' })
  m.pricing = { model: 'free', amount: 5 }
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('key must match')))
  assert.ok(errs.some((e) => e.includes('type must be one of')))
  assert.ok(errs.some((e) => e.includes('a free app has no amount')))
  assert.ok(has(sampleManifest({ pricing: { model: 'flat', amount: 5 } }), 'needs an amount and a currency'))
  assert.equal(validateManifest(sampleManifest({ pricing: { model: 'flat', amount: 5, currency: 'EUR', interval: 'month' } })).ok, true)
})

test('engine: views must name real sources and fields', () => {
  const m = sampleManifest()
  m.ui.views.public.push({ type: 'list', source: 'nowhere' })
  m.ui.views.public.push({ type: 'list', source: 'notes', fields: { title: 'missing' } })
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('unknown source "nowhere"')))
  assert.ok(errs.some((e) => e.includes('unknown field "missing"')))
})

test('engine: every surface points at a view set and back', () => {
  const m = sampleManifest()
  m.surfaces[2].path = '/nope'
  assert.ok(has(m, 'ui.views has no "nope"'))
  assert.ok(has(m, 'ui.views.tv no surface points'))
})

test('engine: owner views cannot be public; owner-only fields never shown publicly', () => {
  const m = sampleManifest()
  m.ui.views.public.push({ type: 'collection', source: 'notes' })
  m.ui.views.public.push({ type: 'list', source: 'notes', fields: { title: 'secret_flag' } })
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('cannot be on a public surface')))
  assert.ok(errs.some((e) => e.includes('owner-only')))
})

test('engine: public reads and writes need the table to say so', () => {
  const m = sampleManifest()
  m.data.tables.notes.public = 'read'
  assert.ok(has(m, 'is not public "append"'))
  const n = sampleManifest()
  n.data.tables.notes.public = 'append'
  assert.ok(has(n, 'is not public "read"'))
})

test('engine: business sources need their read permission; writes need write', () => {
  const m = sampleManifest()
  m.permissions = m.permissions.filter((p) => p.id !== 'things:read')
  assert.ok(has(m, 'must declare "things:read"'))
  const w = sampleManifest()
  w.ui.views.public.push({ type: 'form', source: 'things' })
  w.permissions = w.permissions.filter((p) => p.id !== 'things:write')
  assert.ok(has(w, 'must declare "things:write"'))
})

test('engine: app fields sit on declared columns of a compatible type', () => {
  const m = sampleManifest()
  m.ui.sources.notes.fields.push({ key: 'ghost', label: 'Ghost', type: 'text' })
  m.ui.sources.notes.fields.find((f) => f.key === 'amount').type = 'boolean'
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('"ghost" is not a column')))
  assert.ok(errs.some((e) => e.includes('a boolean field cannot sit on a money column')))
})

test('engine: select fields need options; optionsFrom must resolve; group must be a select', () => {
  const m = sampleManifest()
  delete m.ui.sources.notes.fields.find((f) => f.key === 'kind').options
  m.ui.sources.things.fields.find((f) => f.key === 'group_id').optionsFrom = { source: 'groups', label: 'nope' }
  m.ui.sources.notes.group = 'title'
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('needs options or optionsFrom')))
  assert.ok(errs.some((e) => e.includes('"nope" is not a field of source "groups"')))
  assert.ok(errs.some((e) => e.includes('must name a select field')))
})

test('engine: settings named by views must exist', () => {
  const m = sampleManifest()
  m.ui.views.public.push({ type: 'text', text: { setting: 'absent' } })
  assert.ok(has(m, 'unknown setting "absent"'))
})

test('the ui section is only read for engine apps', () => {
  assert.ok(has(sampleManifest({ runtime: { type: 'service', base_url: 'https://svc.example.test' } }), 'is only read for runtime.type'))
})

test('store rules apply when an item is given', () => {
  const m = sampleManifest()
  assert.equal(validateManifest(m, { item: { key: 'test-sample', kind: 'app' } }).ok, true)
  assert.ok(has(m, 'must be the item key', { item: { key: 'other-key', kind: 'app' } }))
  assert.ok(has(m, 'does not match 2.0.0', { item: { key: 'test-sample', kind: 'app' }, semver: '2.0.0' }))
})

test('parseManifest throws with the first problems; helpers read permissions', () => {
  assert.throws(() => parseManifest({}), /Invalid app manifest/)
  const m = sampleManifest()
  assert.deepEqual(permissionsOf(m).optional.map((p) => p.id), ['things:write'])
  assert.deepEqual(resourcesOf(m), ['things'])
})

test('engine: a public view cannot fall back to an owner-only source title', () => {
  for (const view of [{ type: 'list', source: 'notes' }, { type: 'details', source: 'notes', fields: { body: 'body' } }, { type: 'feed', source: 'notes' }, { type: 'links', source: 'notes', fields: { link: 'link' } }]) {
    const m = sampleManifest()
    m.ui.sources.notes.title = 'secret_flag'
    m.ui.views.public = [view]
    assert.ok(has(m, 'owner-only'), view.type)
    // Bound to another field, the same view is fine.
    const slot = { list: 'title', details: 'summary', feed: 'title', links: 'label' }[view.type]
    m.ui.views.public = [{ ...view, fields: { ...(view.fields || {}), [slot]: 'title' } }]
    assert.ok(!has(m, 'owner-only'), `${view.type} bound`)
  }
})

test('engine: a view set is public when any surface pointing at it is public', () => {
  const m = sampleManifest()
  m.ui.views.public.push({ type: 'list', source: 'notes', fields: { title: 'secret_flag' } })
  // A second, owner surface on the same view set must not launder it.
  m.surfaces.push({ id: 'owner-copy', kind: 'dashboard', path: '/public' })
  assert.ok(has(m, 'owner-only'))
})

test('v1: homepage is an http or https URI only', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://files.example.test', 'not a url']) {
    assert.ok(has(sampleManifest({ homepage: bad }), 'homepage must be an http or https URI'), bad)
  }
  assert.equal(validateManifest(sampleManifest({ homepage: 'https://app.example.test/about' })).ok, true)
  assert.equal(validateManifest(sampleManifest({ homepage: 'http://app.example.test' })).ok, true)
})

test("v1: id follows Paperclip's item key rule (routes/store.ts itemKeySchema): lowercase, digits, dashes, at most 80", () => {
  for (const bad of ['core.qr-menu', 'Core-Menu', 'menu_qr', '-menu', 'a'.repeat(81)]) {
    assert.ok(has(sampleManifest({ id: bad }), 'id must'), bad)
  }
  for (const good of ['nodash', 'core-qr-menu', '1st-app', 'a'.repeat(80)]) {
    assert.ok(!has(sampleManifest({ id: good }), 'id must'), good)
  }
  assert.ok(has(sampleManifest({ requires: { apps: ['other.app'] } }), 'requires.apps[0] must match'))
})

/* ── bindings, actions, inbox (DECISIONS #45, #46, #47) ─────────────────── */

function boundManifest() {
  const m = sampleManifest()
  m.permissions = [
    { id: 'menu:read', reason: 'Shows the menu on the public page.' },
    { id: 'menu:write', reason: 'Edits menu items from inside the app.', optional: true },
    { id: 'business:read', reason: 'Reads the business currency and FAQs.' },
    { id: 'business:write', reason: 'Edits the business FAQs.' },
  ]
  m.bindings = {
    menu: { contract: 'menu.items', access: 'read-write' },
    faqs: { contract: 'faqs.items', access: 'read-write', fieldMap: { question: 'q' } },
    currency: { contract: 'business.currency', access: 'read' },
  }
  m.ui.format = { currency: { binding: 'currency' } }
  m.ui.sources.groups = { from: 'business', binding: 'faqs', label: 'FAQs', labelSingular: 'FAQ', fields: [{ key: 'question', label: 'Question', type: 'text', required: true }], title: 'question' }
  m.ui.sources.things = { from: 'business', binding: 'menu', label: 'Items', labelSingular: 'Item', fields: [{ key: 'item_name', label: 'Name', type: 'text', required: true }], title: 'item_name' }
  m.ui.views.public[0] = { type: 'list', source: 'things', fields: { title: 'item_name' } }
  m.actions = [
    { id: 'list_items', summary: 'Lists the menu items the app shows.', binding: 'menu', kind: 'read' },
    { id: 'add_note', summary: 'Adds a note for the owner.', table: 'notes', kind: 'create' },
  ]
  m.data.tables.notes.inbox = true
  return m
}

test('bindings: a manifest bound to contracts validates, and the contract families are exported', () => {
  const r = validateManifest(boundManifest())
  assert.deepEqual(r.errors, [])
  assert.deepEqual(resourceForContract('menu.items'), 'menu')
  assert.deepEqual(resourceForContract('booking.records'), 'bookings')
  assert.deepEqual(resourceForContract('faqs.items'), 'business')
  assert.equal(resourceForContract('nothing.here'), null)
  assert.ok(CONTRACTS.includes('menu.items') && CONTRACTS.includes('business.links'))
  assert.deepEqual(bindingPermissions(boundManifest()), ['business:read', 'business:write', 'menu:read', 'menu:write'])
})

test('bindings: shape, known family, derived permissions must be declared', () => {
  const bad = boundManifest()
  bad.bindings.menu.access = 'write'
  bad.bindings.odd = { contract: 'unknown.items', access: 'read' }
  bad.bindings['Bad-Key'] = { contract: 'menu.items', access: 'read' }
  bad.bindings.faqs.fieldMap.question = 'Not Snake'
  const errs = errorsOf(bad)
  assert.ok(errs.some((e) => e.includes('bindings.menu.access must be one of read, read-write')))
  assert.ok(errs.some((e) => e.includes('bindings.odd.contract') && e.includes('unknown.items')))
  assert.ok(errs.some((e) => e.includes('bindings.Bad-Key')))
  assert.ok(errs.some((e) => e.includes('bindings.faqs.fieldMap.question')))
  const missing = boundManifest()
  missing.permissions = missing.permissions.filter((p) => p.id !== 'menu:write')
  assert.ok(has(missing, 'bindings.menu reads and writes "menu.items", so permissions must declare "menu:write"'))
  const noRead = boundManifest()
  noRead.permissions = noRead.permissions.filter((p) => p.id !== 'business:read')
  assert.ok(has(noRead, 'must declare "business:read"'))
})

test('bindings: a business source names a binding or a section, never both; writes need read-write', () => {
  const both = boundManifest()
  both.ui.sources.things.section = 'menu_items'
  assert.ok(has(both, 'ui.sources.things names a binding, so it takes no section or resource'))
  const unknown = boundManifest()
  unknown.ui.sources.things.binding = 'nope'
  assert.ok(has(unknown, 'names unknown binding "nope"'))
  const ro = boundManifest()
  ro.bindings.menu.access = 'read'
  ro.permissions = ro.permissions.filter((p) => p.id !== 'menu:write')
  ro.ui.views.public.push({ type: 'form', source: 'things' })
  assert.ok(has(ro, 'writes through binding "menu", which is read only'))
  // The old form still works.
  assert.equal(validateManifest(sampleManifest()).ok, true)
})

test('actions: id, summary, binding or table, kind; writes need a writable target', () => {
  const m = boundManifest()
  m.actions.push({ id: 'list_items', summary: 'Duplicate id for the test.', binding: 'menu', kind: 'read' })
  m.actions.push({ id: 'ghost', summary: 'Names nothing that exists.', binding: 'nope', kind: 'read' })
  m.actions.push({ id: 'both', summary: 'Names a binding and a table.', binding: 'menu', table: 'notes', kind: 'read' })
  m.actions.push({ id: 'ro', summary: 'Writes through a read-only binding.', binding: 'currency', kind: 'update' })
  m.actions.push({ id: 'badkind', summary: 'Has a kind the engine does not know.', table: 'notes', kind: 'delete' })
  m.actions.push({ id: 'short', summary: 'x', table: 'notes', kind: 'read' })
  const errs = errorsOf(m)
  assert.ok(errs.some((e) => e.includes('actions "list_items" is declared twice')))
  assert.ok(errs.some((e) => e.includes('actions[3].binding names unknown binding "nope"')))
  assert.ok(errs.some((e) => e.includes('actions[4] names a binding or a table, not both')))
  assert.ok(errs.some((e) => e.includes('actions[5]') && e.includes('read only')))
  assert.ok(errs.some((e) => e.includes('actions[6].kind must be one of read, create, update')))
  assert.ok(errs.some((e) => e.includes('actions[7].summary must be at least 8')))
  assert.ok(has(sampleManifest({ actions: {} }), 'actions must be a list'))
})

test('inbox: a flag on append tables, defaulting to true for public append', () => {
  const m = sampleManifest()
  m.data.tables.notes.inbox = 'yes'
  assert.ok(has(m, 'data.tables.notes.inbox must be true or false'))
  const closed = sampleManifest()
  closed.data.tables.notes.public = 'read'
  closed.data.tables.notes.inbox = true
  assert.ok(has(closed, 'data.tables.notes.inbox takes visitor submissions, so the table must be public "append"'))
  const byDefault = sampleManifest()
  byDefault.data.tables.notes.public = 'append'
  byDefault.data.tables.letters = { public: 'append', inbox: false, columns: { a: { type: 'text' } } }
  byDefault.data.tables.secret = { columns: { a: { type: 'text' } } }
  assert.deepEqual(inboxTables(byDefault), ['notes'])
  assert.deepEqual(inboxTables(sampleManifest()), ['notes'], 'read-append is an append door too')
})

test('ui.format may read currency and locale from a binding', () => {
  const m = boundManifest()
  m.ui.format.currency = { binding: 'nope' }
  assert.ok(has(m, 'ui.format.currency names unknown binding "nope"'))
  const rw = boundManifest()
  rw.ui.format.currency = { binding: 'menu' }
  assert.ok(has(rw, 'ui.format.currency must name a binding to a business.* contract'))
  assert.ok(has(sampleManifest({ ui: { ...sampleManifest().ui, format: { currency: { setting: 'currency', binding: 'x' } } } }), 'ui.format.currency'))
})

test('events are still validated', () => {
  assert.ok(has(sampleManifest({ events: { emits: ['nodots'] } }), 'events.emits[0] must match'))
  assert.equal(validateManifest(sampleManifest({ events: { emits: ['sample.note_added'] } })).ok, true)
})

test('dotted names allow dashes inside segments (app events are <appKey>.<event>, DECISIONS #54)', () => {
  assert.equal(validateManifest(sampleManifest({ events: { emits: ['qr-menu.submitted'] } })).ok, true)
  assert.ok(has(sampleManifest({ events: { emits: ['Qr.menu'] } }), 'events.emits[0] must match'))
  assert.ok(has(sampleManifest({ events: { emits: ['-qr.menu'] } }), 'events.emits[0] must match'))
})

test('inbox: a read-write binding may flag its visitor submissions for the inbox', () => {
  const m = boundManifest()
  m.bindings.faqs.inbox = true
  assert.deepEqual(validateManifest(m).errors, [])
  assert.deepEqual(inboxBindings(m), ['faqs'])
  m.bindings.currency.inbox = true
  assert.ok(has(m, 'bindings.currency.inbox is only for a read-write binding'))
})
