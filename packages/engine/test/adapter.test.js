import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGcrAdapter, createPublicAdapter, AdapterError, DEFAULT_ROUTES, EXISTING_ROUTES, SINGLE_CONTRACTS, isSingleContract } from '../src/index.js'
import { sampleManifest, sampleData } from './fixtures.js'

function fakeFetch(handler) {
  const calls = []
  const fn = async (url, init) => {
    const call = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }
    calls.push(call)
    const { status = 200, body } = (await handler(call)) || {}
    return new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), { status })
  }
  fn.calls = calls
  return fn
}

const token = async ({ force }) => (force ? 'fresh-token' : 'install-token')

test('every default route is served by gcr-api-clean', () => {
  assert.deepEqual([...EXISTING_ROUTES], Object.keys(DEFAULT_ROUTES))
  assert.equal(DEFAULT_ROUTES.appTable, '/app-data/{table}')
})

test('load reads the install and every source a surface needs, with the install token', async () => {
  const data = sampleData()
  const fetch = fakeFetch(({ url }) => {
    if (url.endsWith('/app-install')) return { body: { installId: 'i1', settings: { currency: 'EUR' }, granted: ['things:read'] } }
    if (url.includes('/business/thing_groups')) return { body: { rows: data.groups } }
    if (url.includes('/business/things')) return { body: { table: 'things', rows: data.things } }
    if (url.includes('/app-data/notes')) return { body: { rows: data.notes } }
    return { status: 404, body: '<html>' }
  })
  const adapter = createGcrAdapter({ baseUrl: 'https://gcr.example.test/api/', getToken: token, fetch })
  const loaded = await adapter.load(sampleManifest(), 'owner')
  assert.deepEqual(loaded.settings, { currency: 'EUR' })
  assert.deepEqual(loaded.granted, ['things:read'])
  assert.equal(loaded.data.things.length, 3)
  assert.equal(loaded.data.notes.length, 3)
  assert.ok(fetch.calls.every((c) => c.headers.Authorization === 'Bearer install-token'))
  assert.ok(fetch.calls.every((c) => !/slug|entity/.test(c.url)), 'no business is ever named in a request')
  assert.ok(fetch.calls.some((c) => c.url === 'https://gcr.example.test/api/business/things'))
})

test('a missing route is reported per source, not fatal', async () => {
  const fetch = fakeFetch(({ url }) => (url.includes('/business/') ? { body: { rows: [] } } : { status: 404, body: '<html>not found</html>' }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  const loaded = await adapter.load(sampleManifest(), 'owner')
  assert.ok(loaded.installError instanceof AdapterError)
  assert.equal(loaded.installError.notConnected, true)
  assert.equal(loaded.errors.notes.notConnected, true)
  assert.deepEqual(loaded.data.notes, [])
})

test('a 401 is retried once with a fresh token', async () => {
  const fetch = fakeFetch(({ headers }) => (headers.Authorization === 'Bearer install-token' ? { status: 401, body: { error: 'expired' } } : { body: { rows: [] } }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  assert.deepEqual(await adapter.list(sampleManifest(), 'things'), [])
  assert.equal(fetch.calls.length, 2)
})

test('writes are checked before they are sent, and only declared fields go', async () => {
  const fetch = fakeFetch(({ method, body }) => ({ status: method === 'POST' ? 201 : 200, body: { row: { id: 'new', ...body } } }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  await assert.rejects(adapter.create(sampleManifest(), 'notes', { title: '' }), (err) => err.status === 422 && Boolean(err.errors.title))
  assert.equal(fetch.calls.length, 0)
  const row = await adapter.create(sampleManifest(), 'notes', { title: 'Hi', sneaky: 'x' }, { rows: sampleData().notes })
  assert.equal(row.id, 'new')
  const sent = fetch.calls[0]
  assert.equal(sent.url, '/biz/app-data/notes')
  assert.ok(!('sneaky' in sent.body))
  assert.equal(sent.body.position, 4, 'new rows go to the end of a sortable source')
  await adapter.update(sampleManifest(), 'things', 't1', { name: 'One!' })
  assert.equal(fetch.calls[1].url, '/biz/business/things/t1')
  assert.equal(fetch.calls[1].method, 'PATCH')
  await adapter.remove(sampleManifest(), 'things', 't1')
  assert.equal(fetch.calls[2].method, 'DELETE')
})

test('move swaps order values with the neighbour', async () => {
  const fetch = fakeFetch(() => ({ body: { row: {} } }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  await adapter.move(sampleManifest(), 'things', sampleData().things, 't1', 'up')
  assert.deepEqual(fetch.calls.map((c) => [c.url, c.body]), [
    ['/biz/business/things/t1', { sort_order: 1 }],
    ['/biz/business/things/t2', { sort_order: 2 }],
  ])
  assert.equal(await adapter.move(sampleManifest(), 'things', sampleData().things, 't2', 'up'), false)
})

test('settings save only declared keys', async () => {
  const fetch = fakeFetch(({ body }) => ({ body }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  const saved = await adapter.saveSettings(sampleManifest(), { currency: 'EUR', injected: 'x' })
  assert.deepEqual(saved, { currency: 'EUR' })
  assert.equal(fetch.calls[0].method, 'PUT')
})

test('public adapter: no token, reads the install, appends only where allowed', async () => {
  const fetch = fakeFetch(({ method, body }) => (method === 'GET' ? { body: { settings: { open: true }, data: { notes: [] } } } : { status: 201, body: { row: body } }))
  const pub = createPublicAdapter({ baseUrl: '/api', installId: 'inst 1', fetch })
  const loaded = await pub.load()
  assert.deepEqual(loaded.settings, { open: true })
  assert.equal(fetch.calls[0].url, '/api/public/apps/inst%201')
  assert.equal(fetch.calls[0].headers.Authorization, undefined)
  const row = await pub.submit(sampleManifest(), 'notes', { title: 'Hello', secret_flag: 'mine' })
  assert.equal(row.secret_flag, 'new')
  assert.equal(fetch.calls[1].url, '/api/public/apps/inst%201/notes')
  await assert.rejects(pub.submit(sampleManifest(), 'things', { name: 'x' }), /app’s own tables/)
  const closed = sampleManifest()
  closed.data.tables.notes.public = 'read'
  await assert.rejects(pub.submit(closed, 'notes', { title: 'x' }), /not open to visitors/)
})

test('network failure is an AdapterError with status 0', async () => {
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch: async () => { throw new Error('offline') } })
  await assert.rejects(adapter.list(sampleManifest(), 'things'), (err) => err instanceof AdapterError && err.status === 0)
})

test('a select with optionsFrom is checked against the rows of its source, loaded as the renderer would', async () => {
  const data = sampleData()
  const fetch = fakeFetch(({ url, method, body }) => {
    if (url.includes('/business/thing_groups')) return { body: { rows: data.groups } }
    return { status: method === 'POST' ? 201 : 200, body: { row: { id: 't1', ...body } } }
  })
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  // Valid reference: saved, with the group source read first.
  const row = await adapter.update(sampleManifest(), 'things', 't1', { name: 'One', group_id: 2 })
  assert.equal(row.group_id, 2)
  assert.ok(fetch.calls.some((c) => c.url === '/biz/business/thing_groups' && c.method === 'GET'))
  const write = fetch.calls.find((c) => c.method === 'PATCH')
  assert.equal(write.body.group_id, 2)
  // Invalid reference: refused before anything is written.
  const before = fetch.calls.length
  await assert.rejects(adapter.create(sampleManifest(), 'things', { name: 'New', group_id: 9 }), (err) => err.status === 422 && Boolean(err.errors.group_id))
  assert.ok(!fetch.calls.slice(before).some((c) => c.method === 'POST'))
  // Rows already in hand are used instead of a second read.
  const n = fetch.calls.length
  await adapter.create(sampleManifest(), 'things', { name: 'New', group_id: 1 }, { data: { groups: data.groups } })
  assert.ok(!fetch.calls.slice(n).some((c) => c.method === 'GET'))
})

test('a visitor form with an optionsFrom select is checked against the public install data', async () => {
  const m = sampleManifest()
  m.data.tables.notes.columns.group_id = { type: 'integer' }
  m.ui.sources.notes.fields.push({ key: 'group_id', label: 'Group', type: 'select', optionsFrom: { source: 'groups', label: 'name' } })
  const fetch = fakeFetch(({ method, body }) => (method === 'GET' ? { body: { settings: {}, data: { notes: [], groups: sampleData().groups } } } : { status: 201, body: { row: body } }))
  const pub = createPublicAdapter({ baseUrl: '/api', installId: 'i1', fetch })
  const row = await pub.submit(m, 'notes', { title: 'Hello', group_id: '2' })
  assert.equal(String(row.group_id), '2')
  await assert.rejects(pub.submit(m, 'notes', { title: 'Hello', group_id: '9' }), (err) => err.status === 422 && Boolean(err.errors.group_id))
})

test('update is a PATCH: only the fields in the payload are checked and sent, nothing else is wiped', async () => {
  const fetch = fakeFetch(({ body }) => ({ body: { row: { id: 't1', ...body } } }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  await adapter.update(sampleManifest(), 'things', 't1', { name: 'One!' })
  assert.deepEqual(fetch.calls[0].body, { name: 'One!' }, 'price and group_id are not sent as null')
  // A field that is in the payload is still checked.
  await assert.rejects(adapter.update(sampleManifest(), 'things', 't1', { name: '' }), (err) => err.status === 422 && Boolean(err.errors.name))
  // Blanking an optional field on purpose still goes through as null.
  await adapter.update(sampleManifest(), 'notes', 'n1', { body: '' })
  assert.deepEqual(fetch.calls[1].body, { body: null })
})

/* ── bindings: business sources resolved through data contracts (DECISIONS #45) ── */

function boundManifest() {
  const m = sampleManifest()
  m.permissions = [
    { id: 'things:read', reason: 'Shows the business things.' },
    { id: 'things:write', reason: 'Edits the business things.', optional: true },
    { id: 'business:read', reason: 'Reads the FAQs and the currency.' },
    { id: 'business:write', reason: 'Edits the FAQs.' },
  ]
  m.bindings = {
    faqs: { contract: 'faqs.items', access: 'read-write', fieldMap: { name: 'question' } },
    currency: { contract: 'business.currency', access: 'read' },
  }
  m.ui.format = { currency: { binding: 'currency' } }
  m.ui.sources.groups = { from: 'business', binding: 'faqs', label: 'FAQs', labelSingular: 'FAQ', fields: [{ key: 'name', label: 'Question', type: 'text', required: true }], title: 'name' }
  return m
}

test('a bound source is read and written at /business/<contract>, with its fieldMap applied both ways', async () => {
  const fetch = fakeFetch(({ url, method, body }) => {
    if (url.endsWith('/app-install')) return { body: { installId: 'i1', settings: {}, granted: ['things:read', 'business:read', 'business:write'] } }
    if (url.includes('/business/faqs.items')) return method === 'GET' ? { body: { rows: [{ id: 'f1', question: 'Why?', answer: 'Because.' }] } } : { status: 201, body: { row: { id: 'f2', ...body } } }
    if (url.endsWith('/business/business.currency')) return { body: { value: 'GBP' } }
    if (url.includes('/business/thing')) return { body: { rows: [] } }
    if (url.includes('/app-data/')) return { body: { rows: [] } }
    return { status: 404, body: '<html>' }
  })
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  const loaded = await adapter.load(boundManifest(), 'owner')
  assert.deepEqual(loaded.data.groups, [{ id: 'f1', name: 'Why?', answer: 'Because.' }], 'columns come back under the field keys the manifest uses')
  assert.deepEqual(loaded.business, { currency: 'GBP' }, 'format bindings are read from the business')
  assert.ok(fetch.calls.some((c) => c.url === '/biz/business/faqs.items' && c.method === 'GET'))
  assert.ok(!fetch.calls.some((c) => c.url.includes('/business/faqs/') || c.url.endsWith('/business/faqs')), 'never the raw table name')
  const row = await adapter.create(boundManifest(), 'groups', { name: 'How?' })
  const sent = fetch.calls.find((c) => c.method === 'POST')
  assert.equal(sent.url, '/biz/business/faqs.items')
  assert.deepEqual(sent.body, { question: 'How?' }, 'the field is written under its column name')
  assert.equal(row.name, 'How?')
  await adapter.update(boundManifest(), 'groups', 'f1', { name: 'When?' })
  const patched = fetch.calls.find((c) => c.method === 'PATCH')
  assert.equal(patched.url, '/biz/business/faqs.items/f1')
  assert.deepEqual(patched.body, { question: 'When?' })
  await adapter.remove(boundManifest(), 'groups', 'f1')
  assert.equal(fetch.calls.at(-1).url, '/biz/business/faqs.items/f1')
})

test('a format binding that cannot be read is reported, not fatal; rows[0] of a contract also serve as its value', async () => {
  const fetch = fakeFetch(({ url }) => {
    if (url.endsWith('/business/business.currency')) return { status: 403, body: { error: 'business:read not granted' } }
    if (url.includes('/business/')) return { body: { rows: [] } }
    if (url.includes('/app-data/')) return { body: { rows: [] } }
    return { body: { installId: 'i1', settings: {} } }
  })
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  const loaded = await adapter.load(boundManifest(), 'public')
  assert.deepEqual(loaded.business, {})
  assert.equal(loaded.errors.currency.forbidden, true)
  const rowy = fakeFetch(({ url }) => (url.endsWith('/business/business.currency') ? { body: { rows: [{ currency: 'EUR' }] } } : url.includes('/app-install') ? { body: {} } : { body: { rows: [] } }))
  const second = await createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch: rowy }).load(boundManifest(), 'owner')
  assert.deepEqual(second.business, { currency: 'EUR' })
})

test('the public adapter carries the business values and maps bound rows to field keys', async () => {
  const fetch = fakeFetch(() => ({ body: { settings: {}, data: { groups: [{ id: 'f1', question: 'Why?' }], notes: [] }, business: { currency: 'USD' } } }))
  const pub = createPublicAdapter({ baseUrl: '/api', installId: 'i1', fetch })
  const loaded = await pub.load(boundManifest())
  assert.deepEqual(loaded.business, { currency: 'USD' })
  assert.deepEqual(loaded.data.groups, [{ id: 'f1', name: 'Why?' }])
  // Without a manifest the body is passed through as before.
  const plain = await pub.load()
  assert.deepEqual(plain.data.groups, [{ id: 'f1', question: 'Why?' }])
  assert.deepEqual(plain.business, { currency: 'USD' })
})

test('a visitor may submit into a read-write bound source; the install resolves the binding server side', async () => {
  const m = boundManifest()
  m.permissions.push({ id: 'things:write', reason: 'dup guard' })
  m.permissions = m.permissions.filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
  m.ui.views.public.push({ type: 'form', source: 'groups' })
  const fetch = fakeFetch(({ method, body }) => (method === 'GET' ? { body: { settings: {}, data: {} } } : { status: 201, body: { row: { id: 'f9', ...body } } }))
  const pub = createPublicAdapter({ baseUrl: '/api', installId: 'i1', fetch })
  const row = await pub.submit(m, 'groups', { name: 'Why?' })
  const sent = fetch.calls.find((c) => c.method === 'POST')
  assert.equal(sent.url, '/api/public/apps/i1/groups', 'the source key names the binding to resolve')
  assert.deepEqual(sent.body, { question: 'Why?' }, 'written under the column name')
  assert.equal(row.name, 'Why?')
  const ro = boundManifest()
  ro.bindings.faqs.access = 'read'
  await assert.rejects(pub.submit(ro, 'groups', { name: 'x' }), /not open to visitors/)
})

/* ── an image file, into the business's storage (gcr-api-clean POST /api/business/media/upload, DECISIONS #99) ── */

/** A fetch stub that keeps a multipart body as it is (fakeFetch above parses JSON). */
function formFetch(handler) {
  const calls = []
  const fn = async (url, init) => {
    const call = { url, method: init.method, headers: init.headers, body: init.body }
    calls.push(call)
    const { status = 200, body } = (await handler(call)) || {}
    return new Response(body === undefined ? null : JSON.stringify(body), { status })
  }
  fn.calls = calls
  return fn
}

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' })

test('uploadImage posts the file as multipart `file` with the install token and returns { url, image_path }', async () => {
  const fetch = formFetch(() => ({ body: { url: 'https://cdn.example.test/biz/1-ab.png', image_path: 'biz/1-ab.png' } }))
  const adapter = createGcrAdapter({ baseUrl: 'https://gcr.example.test/api/', getToken: token, fetch })
  const out = await adapter.uploadImage(png())
  assert.deepEqual(out, { url: 'https://cdn.example.test/biz/1-ab.png', image_path: 'biz/1-ab.png' })
  const [call] = fetch.calls
  assert.equal(call.url, 'https://gcr.example.test/api/business/media/upload')
  assert.equal(call.method, 'POST')
  assert.equal(call.headers.Authorization, 'Bearer install-token')
  assert.equal(call.headers['Content-Type'], undefined, 'the browser sets the multipart boundary')
  assert.ok(call.body instanceof FormData)
  const sent = call.body.get('file')
  assert.ok(sent instanceof Blob)
  assert.equal(sent.type, 'image/png')
  assert.equal(sent.name, 'photo.png')
  assert.deepEqual([...call.body.keys()], ['file'], 'nothing else rides along — the business is the token\'s')
})

test('uploadImage refuses anything but an image before sending, and surfaces the server\'s refusals', async () => {
  const fetch = formFetch(() => ({ status: 413, body: { error: 'The file is over 1000 bytes.' } }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  await assert.rejects(adapter.uploadImage(new File(['x'], 'notes.txt', { type: 'text/plain' })), (err) => err instanceof AdapterError && err.status === 400 && /image/.test(err.message))
  await assert.rejects(adapter.uploadImage('https://not.a/file'), (err) => err instanceof AdapterError && err.status === 400)
  assert.equal(fetch.calls.length, 0)
  await assert.rejects(adapter.uploadImage(png()), (err) => err instanceof AdapterError && err.status === 413 && err.message === 'The file is over 1000 bytes.')
  const forbidden = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch: formFetch(() => ({ status: 403, body: { error: 'This connection is not allowed to upload media.' } })) })
  await assert.rejects(forbidden.uploadImage(png()), (err) => err.forbidden)
})

test('uploadValues: a File in an image field is uploaded and replaced by its url; links are left as typed', async () => {
  const fetch = formFetch(() => ({ body: { url: 'https://cdn.example.test/p.png', image_path: 'p.png' } }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  const values = await adapter.uploadValues(sampleManifest(), 'notes', { title: 'Hi', picture: png(), link: 'https://a.example.test' })
  assert.deepEqual(values, { title: 'Hi', picture: 'https://cdn.example.test/p.png', link: 'https://a.example.test' })
  assert.equal(fetch.calls.length, 1)
  const typed = await adapter.uploadValues(sampleManifest(), 'notes', { picture: 'https://img.example.test/1.png' })
  assert.deepEqual(typed, { picture: 'https://img.example.test/1.png' }, 'the URL field still works')
  assert.equal(fetch.calls.length, 1)
  // A file in a field that is not an image field is not uploaded, so nothing but pictures reach storage.
  await assert.rejects(adapter.uploadValues(sampleManifest(), 'notes', { title: png() }), (err) => err.status === 422 && Boolean(err.errors.title))
})

test('the public adapter cannot upload: no token, no storage', () => {
  const pub = createPublicAdapter({ baseUrl: '/api', installId: 'i1', fetch: formFetch(() => ({})) })
  assert.equal(pub.uploadImage, undefined)
  assert.equal(pub.uploadValues, undefined)
})

/* ── single-record contracts (business.profile: gcr-api-clean DECISIONS #96) ── */

function profileManifest() {
  const m = boundManifest()
  m.bindings.place = { contract: 'business.profile', access: 'read-write' }
  m.ui.sources.place = {
    from: 'business', binding: 'place', label: 'Place', labelSingular: 'Place',
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'address_display', label: 'Address', type: 'text', readOnly: true }],
    title: 'name',
  }
  return m
}

test('a single-record contract is PATCHed without an id; create and delete are refused here with the server\'s reason', async () => {
  const fetch = fakeFetch(({ body }) => ({ body: { row: { slug: 'biz', name: 'Place', address_display: '1 Street, Town', ...body } } }))
  const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: token, fetch })
  const m = profileManifest()
  assert.ok(SINGLE_CONTRACTS.includes('business.profile') && isSingleContract('business.profile') && !isSingleContract('faqs.items'))
  const row = await adapter.update(m, 'place', 'row-0', { name: 'Renamed', address_display: 'typed over' })
  assert.deepEqual(fetch.calls.map((c) => [c.method, c.url, c.body]), [['PATCH', '/biz/business/business.profile', { name: 'Renamed' }]], 'no id, and the derived field is never written')
  assert.equal(row.address_display, '1 Street, Town', 'the read carries the derived field')
  await assert.rejects(adapter.create(m, 'place', { name: 'Second' }), (err) => err instanceof AdapterError && err.status === 405 && err.message === "business.profile is this business's one record: PATCH it.")
  await assert.rejects(adapter.remove(m, 'place', 'biz'), (err) => err instanceof AdapterError && err.status === 405 && /one record/.test(err.message))
  assert.equal(fetch.calls.length, 1, 'neither reached the server')
  // Any other contract still writes by id.
  await adapter.update(m, 'groups', 'f1', { name: 'When?' })
  assert.equal(fetch.calls.at(-1).url, '/biz/business/faqs.items/f1')
})
