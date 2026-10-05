import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { validateManifest, renderOwner, renderHtml, checkBlocks, walkBlocks, VIEW_TYPES } from '../src/index.js'
import { Blocks } from '../src/react.js'
import { templatesManifest, templatesData } from './fixtures.js'

// CONS phase 10 (admin) templates as engine view types (DECISIONS #51), owner-only.

const NOW = Date.parse('2026-03-10T12:00:00Z')
const all = (blocks) => [...walkBlocks(blocks)]
const errorsOf = (m) => validateManifest(m).errors.map((e) => `${e.path} ${e.message}`)
const has = (m, needle) => errorsOf(m).some((e) => e.includes(needle))
const ADMIN = ['profile-editor', 'media-manager', 'menu-editor', 'listing-manager', 'availability-calendar']

test('the admin templates exist and are owner-only; they need their required slots', () => {
  for (const t of ADMIN) assert.equal(VIEW_TYPES[t].owner, true, t)
  const required = { 'media-manager': 'image', 'availability-calendar': 'date' }
  for (const [type, slot] of Object.entries(required)) {
    const m = templatesManifest()
    delete m.ui.views.owner.find((v) => v.type === type).fields[slot]
    assert.ok(has(m, `needs its ${slot} field`), `${type} without ${slot}`)
  }
  const leaked = templatesManifest()
  leaked.ui.views.public.push({ type: 'menu-editor', source: 'dishes', fields: { title: 'item_name' } })
  assert.ok(has(leaked, 'is for the owner'))
})

test('owner render: every admin template produces valid blocks', () => {
  const blocks = renderOwner(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US' })
  assert.deepEqual(checkBlocks(blocks), [])
  assert.deepEqual(blocks.map((b) => b.title), ['Place', 'Photos', 'Dishes', 'Catalogue', 'Claims'])
})

test('profile-editor: one form over the single row; read only without write access', () => {
  const blocks = renderOwner(templatesManifest(), {}, templatesData())
  const form = all(blocks.find((b) => b.title === 'Place').blocks).find((b) => b.type === 'form')
  assert.equal(form.values.name, 'Place 1')
  assert.deepEqual(form.submit.action, { type: 'record.update', source: 'place', id: 'b1' })
  const readOnly = renderOwner(templatesManifest(), {}, templatesData(), { granted: ['business:read', 'menu:read', 'availability:read'] })
  const place = readOnly.find((b) => b.title === 'Place')
  assert.ok(!all(place.blocks).some((b) => b.type === 'form'))
  assert.ok(all(place.blocks).some((b) => b.type === 'details'))
  const none = renderOwner(templatesManifest(), {}, { ...templatesData(), place: [] })
  assert.equal(all(none.find((b) => b.title === 'Place').blocks).find((b) => b.type === 'form').submit.action.type, 'record.create')
})

test('media-manager: a gallery with reorder, set-cover, edit and delete on every photo', () => {
  const blocks = renderOwner(templatesManifest(), {}, templatesData())
  const photos = blocks.find((b) => b.title === 'Photos')
  const gallery = all(photos.blocks).find((b) => b.type === 'gallery')
  assert.deepEqual(gallery.items.map((i) => i.id), ['p1', 'p2', 'p3'], 'the owner sees the stored order')
  const types = gallery.items[0].actions.map((a) => a.action.type)
  assert.deepEqual(types, ['record.move', 'record.move', 'record.update', 'view.edit', 'record.delete'])
  const setCover = gallery.items[0].actions[2]
  assert.deepEqual(setCover.action.values, { is_cover: true })
  assert.ok(!gallery.items[2].actions.some((a) => a.action.values), 'the cover has no set-cover button')
  assert.ok(all(photos.blocks).some((b) => b.type === 'button' && b.action.type === 'view.new'))
})

test('menu-editor: sections in order with their items, availability toggle and inline price edit', () => {
  const blocks = renderOwner(templatesManifest(), {}, templatesData(), {}, { locale: 'en-US', currency: 'EUR' })
  const dishes = blocks.find((b) => b.title === 'Dishes')
  const sections = dishes.blocks.filter((b) => b.type === 'section')
  assert.deepEqual(sections.map((s) => s.title), ['Category 1', 'Category 2'])
  assert.ok(sections[0].actions.some((a) => a.action.type === 'record.move' && a.action.source === 'categories'))
  const list = sections[0].blocks.find((b) => b.type === 'list')
  const d2 = list.items.find((i) => i.id === 'd2')
  const toggle = d2.actions.find((a) => a.action.type === 'record.update')
  assert.deepEqual(toggle.action.values, { is_available: true })
  assert.equal(toggle.label, 'Mark available')
  const d1 = list.items.find((i) => i.id === 'd1')
  assert.equal(d1.actions.find((a) => a.action.type === 'record.update').label, 'Mark sold out')
  assert.equal(d1.form.fields.length, 1)
  assert.equal(d1.form.fields[0].key, 'price')
  assert.equal(d1.form.values.price, 9.5)
  assert.deepEqual(d1.form.submit.action, { type: 'record.update', source: 'dishes', id: 'd1' })
  const adds = all(dishes.blocks).filter((b) => b.type === 'button' && b.action.type === 'view.new').map((b) => b.action.source)
  assert.deepEqual(adds, ['dishes', 'categories'])
})

test('listing-manager: cards by kind with show/hide, edit, delete and a kind filter', () => {
  const blocks = renderOwner(templatesManifest(), {}, templatesData())
  const cat = blocks.find((b) => b.title === 'Catalogue')
  assert.ok(cat.blocks.some((b) => b.type === 'nav' && b.style === 'filter'))
  const items = all(cat.blocks).filter((b) => b.type === 'list').flatMap((l) => l.items)
  const hidden = items.find((i) => i.id === 'l2')
  assert.equal(hidden.unavailable, true)
  assert.deepEqual(hidden.actions.find((a) => a.action.type === 'record.update').action.values, { active: true })
  assert.equal(hidden.actions.find((a) => a.action.type === 'record.update').label, 'Show')
})

test('availability-calendar: a month of days, add on a day, edit and delete on a claim', () => {
  const blocks = renderOwner(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US' })
  const cal = all(blocks.find((b) => b.title === 'Claims').blocks).find((b) => b.type === 'calendar')
  assert.equal(cal.style, 'month')
  const day = cal.days.find((d) => d.date === '2026-03-12')
  assert.deepEqual(day.actions[0].action, { type: 'view.new', source: 'claims', values: { date: '2026-03-12' } })
  assert.deepEqual(day.entries[0].actions.map((a) => a.action.type), ['view.edit', 'record.delete'])
  // Opening "add" on a day prefills the form with that date.
  const adding = renderOwner(templatesManifest(), {}, templatesData(), { now: NOW, editing: { source: 'claims', id: null }, values: { 'claims:new': { date: '2026-03-12' } } }, { now: NOW })
  const form = all(adding).find((b) => b.type === 'form' && b.id === 'claims:new')
  assert.equal(form.values.date, '2026-03-12')
})

test('html and react: every admin template draws with fixture rows', () => {
  const owner = renderHtml(renderOwner(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US' }))
  for (const needle of ['ng-calendar--month', 'ng-gallery', 'ng-section-actions', 'ng-item-form', 'ng-weekday', 'ng-day-actions']) assert.ok(owner.includes(needle), needle)
  const react = renderToStaticMarkup(h(Blocks, { blocks: renderOwner(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US' }) }))
  for (const needle of ['ng-calendar--month', 'ng-section-actions', 'ng-item-form', 'Mark sold out', 'Make cover']) assert.ok(react.includes(needle), needle)
})

