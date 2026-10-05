import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { checkValues, formatValue, validateManifest, renderPublic, renderOwner, renderHtml, walkBlocks, FIELD_TYPES, INPUT_TYPES } from '../src/index.js'
import { Blocks } from '../src/react.js'
import { sampleManifest, templatesManifest, templatesData } from './fixtures.js'

// The `tags` field type: a list of short strings. gcr-api-clean serves a
// text[] column (menu.items.tags, DECISIONS #98) as an array and takes a
// write as an array or a comma-separated string; the engine reads either,
// edits as comma text and sends the array.

const tags = { key: 'tags', label: 'Badges', type: 'tags' }
const all = (blocks) => [...walkBlocks(blocks)]

test('tags: an array or comma text is checked into a trimmed list; blank is null', () => {
  assert.deepEqual(checkValues([tags], { tags: ['Spicy ', '', ' Vegan'] }), { ok: true, data: { tags: ['Spicy', 'Vegan'] } })
  assert.deepEqual(checkValues([tags], { tags: ' spicy, vegan,, ' }), { ok: true, data: { tags: ['spicy', 'vegan'] } })
  assert.deepEqual(checkValues([tags], { tags: '' }), { ok: true, data: { tags: null } })
  assert.deepEqual(checkValues([tags], { tags: [] }), { ok: true, data: { tags: null } })
  assert.deepEqual(checkValues([{ ...tags, required: true }], { tags: [] }).errors, { tags: 'Badges is required.' })
  assert.ok(checkValues([tags], { tags: 42 }).errors.tags.includes('list'))
  assert.ok(checkValues([tags], { tags: [{ no: 'objects' }] }).errors.tags.includes('list'))
})

test('tags: each entry is held to maxLength and the list to max entries', () => {
  assert.deepEqual(checkValues([{ ...tags, maxLength: 5 }], { tags: 'ok, too long' }).errors, { tags: 'Badges entries must be 5 characters or fewer.' })
  assert.deepEqual(checkValues([{ ...tags, max: 2 }], { tags: 'a, b, c' }).errors, { tags: 'Badges takes at most 2 entries.' })
  assert.equal(checkValues([tags], { tags: 'x'.repeat(41) }).ok, false, 'a default entry limit applies')
  assert.equal(checkValues([tags], { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }).ok, false, 'a default list limit applies')
})

test('tags: shown as comma text; a plain list of text is left alone', () => {
  assert.equal(formatValue(tags, ['Spicy', 'Vegan']), 'Spicy, Vegan')
  assert.equal(formatValue(tags, 'spicy, vegan'), 'spicy, vegan')
  assert.equal(formatValue(tags, null), '')
})

test('tags: a field type the manifest accepts, on a json or text column of an app table', () => {
  assert.ok(FIELD_TYPES.includes('tags'))
  assert.ok(INPUT_TYPES.includes('tags'))
  const m = sampleManifest()
  m.data.tables.notes.columns.labels = { type: 'json' }
  m.ui.sources.notes.fields.push({ key: 'labels', label: 'Labels', type: 'tags' })
  assert.deepEqual(validateManifest(m).errors, [])
  m.data.tables.notes.columns.labels = { type: 'integer' }
  assert.ok(validateManifest(m).errors.some((e) => e.message.includes('tags field cannot sit on a integer column')))
})

test('tags: badges in the menu and listings views, from an array or comma text', () => {
  const m = templatesManifest()
  const data = templatesData()
  assert.equal(m.ui.sources.dishes.fields.find((f) => f.key === 'tags').type, 'tags', 'the fixture dishes carry a tags field')
  m.ui.sources.catalogue.fields.push({ key: 'labels', label: 'Labels', type: 'tags' })
  m.ui.views.public.find((v) => v.type === 'listings').fields.badges = 'labels'
  data.catalogue[0].labels = 'New, Popular'
  data.catalogue[2].labels = ['Quiet']
  assert.deepEqual(validateManifest(m).errors, [])
  const blocks = renderPublic(m, {}, data, {}, { locale: 'en-US', currency: 'EUR' })
  const dish = all(blocks).filter((b) => b.type === 'list').flatMap((l) => l.items).find((i) => i.id === 'd1')
  assert.deepEqual(dish.badges, ['Tag A', 'Tag B'])
  const items = all(blocks.find((b) => b.title === 'Listings').blocks).filter((b) => b.type === 'list').flatMap((l) => l.items)
  assert.deepEqual(items.find((i) => i.id === 'l1').badges, ['New', 'Popular'])
  assert.deepEqual(items.find((i) => i.id === 'l3').badges, ['Quiet'])
  assert.equal(items.find((i) => i.id === 'l4').badges, undefined)
})

test('tags: the owner edits them as one comma-separated text input, in HTML and React', () => {
  const blocks = renderOwner(templatesManifest(), {}, templatesData(), { editing: { source: 'dishes', id: 'd1' } })
  const form = all(blocks).find((b) => b.type === 'form' && b.id === 'dishes:d1')
  const field = form.fields.find((f) => f.key === 'tags')
  assert.equal(field.type, 'tags')
  assert.deepEqual(form.values.tags, ['Tag A', 'Tag B'], 'the stored list is what the form holds')
  const html = renderHtml([form])
  assert.ok(html.includes('class="ng-field ng-field--tags"'))
  assert.ok(html.includes('type="text" value="Tag A, Tag B"'), html)
  const react = renderToStaticMarkup(h(Blocks, { blocks: [form] }))
  assert.ok(react.includes('ng-field--tags'))
  assert.ok(react.includes('value="Tag A, Tag B"'), react)
})
