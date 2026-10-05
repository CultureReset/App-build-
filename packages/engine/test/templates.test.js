import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { validateManifest, renderPublic, renderHtml, checkBlocks, walkBlocks, VIEW_TYPES, BLOCK_TYPES } from '../src/index.js'
import { Blocks } from '../src/react.js'
import { templatesManifest, templatesData } from './fixtures.js'

// CONS phase 9 (public) templates as engine view types; phase 10 (admin) is
// test/templates-admin.test.js
// (DECISIONS #51). Fixture rows are plainly fake ("Item 1"); nothing here
// names a business or an industry.

const NOW = Date.parse('2026-03-10T12:00:00Z')
const all = (blocks) => [...walkBlocks(blocks)]
const json = (x) => JSON.stringify(x)
const errorsOf = (m) => validateManifest(m).errors.map((e) => `${e.path} ${e.message}`)
const has = (m, needle) => errorsOf(m).some((e) => e.includes(needle))
const PUBLIC = ['profile', 'actions', 'social', 'gallery', 'menu', 'listings', 'availability']

test('the template view types exist, public ones for visitors, admin ones owner-only', () => {
  for (const t of PUBLIC) assert.ok(VIEW_TYPES[t], t)
  for (const t of PUBLIC) assert.ok(!VIEW_TYPES[t].owner, t)
  assert.deepEqual(validateManifest(templatesManifest()).errors, [])
})

test('validator: each template needs its required slots and refuses unknown ones', () => {
  const required = { social: 'link', gallery: 'image', availability: 'date' }
  for (const [type, slot] of Object.entries(required)) {
    const m = templatesManifest()
    const set = VIEW_TYPES[type].owner ? 'owner' : 'public'
    const view = m.ui.views[set].find((v) => v.type === type)
    delete view.fields[slot]
    assert.ok(has(m, `needs its ${slot} field`), `${type} without ${slot}: ${errorsOf(m).join(' | ')}`)
  }
  const m = templatesManifest()
  m.ui.views.public.find((v) => v.type === 'menu').fields.nonsense = 'name'
  assert.ok(has(m, 'fields.nonsense is not an allowed property'))
  // Boolean and date slots must sit on fields of that type.
  const typed = templatesManifest()
  typed.ui.views.public.find((v) => v.type === 'menu').fields.available = 'item_name'
  assert.ok(has(typed, 'available must name a boolean field'))
  const dated = templatesManifest()
  dated.ui.views.public.find((v) => v.type === 'availability').fields.date = 'title'
  assert.ok(has(dated, 'date must name a date field'))
  // Actions must bind at least one way to reach the business.
  const empty = templatesManifest()
  empty.ui.views.public.find((v) => v.type === 'actions').fields = {}
  assert.ok(has(empty, 'binds at least one of'))
})

test('public render: every template produces valid blocks of the expected shape', () => {
  const blocks = renderPublic(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US', currency: 'EUR' })
  assert.deepEqual(checkBlocks(blocks), [])
  const types = new Set(all(blocks).map((b) => b.type))
  for (const t of ['profile', 'buttons', 'gallery', 'nav', 'list', 'calendar']) assert.ok(types.has(t), t)
  for (const t of types) assert.ok(BLOCK_TYPES.includes(t), t)
})

test('profile: identity from the first row, with its actions', () => {
  const blocks = renderPublic(templatesManifest(), {}, templatesData(), {}, { now: NOW })
  const profile = all(blocks).find((b) => b.type === 'profile')
  assert.equal(profile.name, 'Place 1')
  assert.equal(profile.location, 'Street 1')
  assert.equal(profile.image.src, 'https://img.example.test/logo.png')
  assert.deepEqual(profile.actions.map((a) => a.key), ['call', 'email', 'website', 'book', 'directions'])
  assert.equal(profile.actions[0].href, 'tel:+15550101')
  assert.equal(profile.actions[1].href, 'mailto:hello@example.test')
})

test('actions: one button per bound contact point, phone and email become tel: and mailto:', () => {
  const blocks = renderPublic(templatesManifest(), {}, templatesData())
  const actions = blocks.find((b) => b.title === 'Reach us')
  const buttons = all(actions.blocks).find((b) => b.type === 'buttons')
  assert.equal(buttons.style, 'icons')
  assert.deepEqual(buttons.items.map((b) => [b.key, b.href]), [
    ['call', 'tel:+15550101'], ['sms', 'sms:+15550101'], ['email', 'mailto:hello@example.test'],
    ['website', 'https://example.test/'], ['book', 'https://book.example.test/'], ['directions', 'https://maps.example.test/x'],
  ])
  assert.equal(buttons.items[0].label, 'Call')
})

test('social: a row per link, keyed by a slug of its label so a stylesheet can pick it', () => {
  const blocks = renderPublic(templatesManifest(), {}, templatesData())
  const social = blocks.find((b) => b.title === 'Elsewhere')
  const buttons = all(social.blocks).find((b) => b.type === 'buttons')
  assert.deepEqual(buttons.items.map((b) => b.key), ['network-a', 'network-b'])
  assert.equal(buttons.items[0].href, 'https://a.example.test/')
  assert.ok(!json(buttons).includes('javascript:'))
})

test('gallery: cover first, captions kept, unsafe sources dropped', () => {
  const blocks = renderPublic(templatesManifest(), {}, templatesData())
  const gallery = all(blocks).find((b) => b.type === 'gallery')
  assert.equal(gallery.style, 'grid')
  assert.deepEqual(gallery.items.map((i) => i.id), ['p3', 'p1', 'p2'])
  assert.equal(gallery.items[0].cover, true)
  assert.equal(gallery.items[0].caption, 'Photo 3')
  assert.equal(gallery.items.length, 3, 'the data: URL row is dropped')
})

test('menu: sticky category nav, one section per category, cards with price, badges and sold-out state', () => {
  const blocks = renderPublic(templatesManifest(), {}, templatesData(), {}, { locale: 'en-US', currency: 'EUR' })
  const menu = blocks.find((b) => b.title === 'Menu')
  const nav = menu.blocks.find((b) => b.type === 'nav')
  assert.deepEqual(nav.items.map((i) => i.label), ['Category 1', 'Category 2'])
  const sections = menu.blocks.filter((b) => b.type === 'section')
  assert.deepEqual(sections.map((s) => s.id), nav.items.map((i) => i.target))
  const list = sections[0].blocks.find((b) => b.type === 'list')
  assert.equal(list.style, 'menu')
  const first = list.items.find((i) => i.id === 'd1')
  assert.equal(first.value, '€9.50')
  assert.deepEqual(first.badges, ['Tag A', 'Tag B'])
  assert.equal(first.image.src, 'https://img.example.test/d1.png')
  assert.equal(first.detail, true, 'a card with a description opens a detail')
  const soldOut = list.items.find((i) => i.id === 'd2')
  assert.equal(soldOut.unavailable, true, 'sold-out items stay on the menu, marked')
  assert.ok(soldOut.badges.includes('Sold out'))
})

test('listings: cards with kind badge, price per unit, capacity, a kind filter and a detail', () => {
  const blocks = renderPublic(templatesManifest(), {}, templatesData(), {}, { locale: 'en-US', currency: 'EUR' })
  const listings = blocks.find((b) => b.title === 'Listings')
  const nav = listings.blocks.find((b) => b.type === 'nav')
  assert.equal(nav.style, 'filter')
  assert.deepEqual(nav.items.map((i) => i.label), ['Kind A', 'Kind B'])
  const items = all(listings.blocks).filter((b) => b.type === 'list').flatMap((l) => l.items)
  const one = items.find((i) => i.id === 'l1')
  assert.equal(one.badge, 'Kind A')
  assert.equal(one.value, '€100 per unit')
  assert.deepEqual(one.meta, ['Up to 4'])
  assert.equal(one.detail, true)
})

test('availability: claims become dated entries; month and week styles draw a grid of days', () => {
  const list = renderPublic(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US' })
  const cal = all(list).find((b) => b.type === 'calendar')
  assert.equal(cal.style, 'list')
  assert.deepEqual(cal.days.map((d) => d.date), ['2026-03-12', '2026-03-13', '2026-03-14'], 'a two-night claim covers both nights')
  assert.equal(cal.days[0].entries[0].status, 'active')
  assert.equal(cal.days[0].entries[0].capacity, 2)
  const m = templatesManifest()
  m.ui.views.public.find((v) => v.type === 'availability').style = 'month'
  const month = all(renderPublic(m, {}, templatesData(), {}, { now: NOW, locale: 'en-US' })).find((b) => b.type === 'calendar')
  assert.equal(month.days.length, 31)
  assert.equal(month.days[0].weekday, 0, 'March 2026 starts on a Sunday')
  assert.equal(month.days.find((d) => d.date === '2026-03-10').today, true)
  assert.equal(month.weekdays.length, 7)
  m.ui.views.public.find((v) => v.type === 'availability').style = 'week'
  const week = all(renderPublic(m, {}, templatesData(), {}, { now: NOW, locale: 'en-US' })).find((b) => b.type === 'calendar')
  assert.equal(week.days.length, 7)
  assert.equal(week.days[0].date, '2026-03-10')
})

test('html: every template block draws, escaped, with no unsafe URL', () => {
  const pub = renderHtml(renderPublic(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US', currency: 'EUR' }))
  for (const needle of ['ng-profile', 'ng-nav--anchors', 'ng-nav--filter', 'ng-gallery--grid', 'ng-lightbox', 'ng-list--menu', 'ng-item--unavailable', 'ng-item-badges', 'ng-list--listings', 'ng-calendar--list', '<details', 'ng-key-call']) {
    assert.ok(pub.includes(needle), needle)
  }
  assert.ok(pub.includes('&lt;b&gt;Place 1'), 'text is escaped')
  assert.ok(!pub.includes('javascript:'))
  assert.ok(!pub.includes('data:image'))
})

test('react: every template smoke-renders with fixture rows', () => {
  const draw = (blocks) => renderToStaticMarkup(h(Blocks, { blocks }))
  const pub = draw(renderPublic(templatesManifest(), {}, templatesData(), {}, { now: NOW, locale: 'en-US', currency: 'EUR' }))
  for (const needle of ['ng-profile', 'ng-nav--anchors', 'ng-gallery--grid', 'ng-gallery-open', 'ng-list--menu', 'ng-item--unavailable', 'ng-calendar--list', 'ng-key-call']) assert.ok(pub.includes(needle), needle)
  assert.ok(!pub.includes('ng-lightbox--open'), 'the lightbox opens on a tap, not on load')
  assert.ok(!pub.includes('javascript:'))
  assert.ok(pub.includes('&lt;b&gt;Place 1'))
})

test('a modifier from data (button key, status) is slugged, never interpolated raw', () => {
  const payload = '" onmouseover="alert(1)'
  const html = renderHtml([
    { type: 'buttons', style: 'inline', items: [{ label: 'x', href: 'https://example.test', key: payload }] },
    { type: 'nav', style: 'anchors', items: [{ label: 'n', target: payload }] },
    { type: 'section', id: payload, blocks: [] },
    { type: 'calendar', style: 'list', days: [{ date: '2026-01-01', label: 'd', weekday: payload, entries: [{ title: 't', status: payload }] }] },
  ])
  assert.ok(!html.includes('" onmouseover'), html)
  assert.ok(!html.includes('ng-key-'), 'a key that is not a slug is dropped')
  assert.ok(html.includes('&quot; onmouseover=&quot;alert(1)'), 'text from data stays text')
})
