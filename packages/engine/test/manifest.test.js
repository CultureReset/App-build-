import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateManifest, parseManifest, permissionsOf, resourcesOf } from '../src/index.js'
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
  assert.ok(has(sampleManifest({ id: 'nodash' }), 'id must match'))
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
