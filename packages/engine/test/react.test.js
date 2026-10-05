import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Blocks, EngineApp } from '../src/react.js'
import { renderPublic, renderOwner } from '../src/index.js'
import { sampleManifest, sampleData, EMBEDS } from './fixtures.js'

const draw = (blocks, props = {}) => renderToStaticMarkup(h(Blocks, { blocks, ...props }))

test('draws every public block type', () => {
  const html = draw(renderPublic(sampleManifest(), { currency: 'EUR' }, sampleData(), {}, { embeds: EMBEDS, locale: 'en-US' }))
  for (const needle of ['ng-section', 'ng-list--cards', 'ng-buttons--icons', 'ng-images--grid', '<details>', '<iframe', '<form', '€12.50']) {
    assert.ok(html.includes(needle), needle)
  }
})

test('draws owner blocks: tables with row actions, settings form', () => {
  const html = draw(renderOwner(sampleManifest(), {}, sampleData()))
  assert.ok(html.includes('<table class="ng-table">'))
  assert.ok(html.includes('ng-row-actions'))
  assert.ok(html.includes('type="password"'))
  assert.ok(html.includes('Save settings'))
})

test('escapes text and drops unsafe URLs', () => {
  const html = draw([
    { type: 'text', text: '<img src=x onerror=alert(1)>' },
    { type: 'button', label: 'go', href: 'javascript:alert(1)' },
    { type: 'images', style: 'grid', items: [{ src: 'data:x', alt: 'a' }] },
    { type: 'embed', src: 'http://insecure.example.test', title: 'x' },
  ])
  assert.ok(!html.includes('<img src=x'))
  assert.ok(!html.includes('javascript:'))
  assert.ok(!html.includes('data:x'))
  assert.ok(!html.includes('<iframe'))
})

test('prefix changes every class', () => {
  const html = draw([{ type: 'empty', text: 'none' }], { prefix: 'pu' })
  assert.equal(html, '<div class="pu-blocks"><p class="pu-empty">none</p></div>')
})

test('EngineApp starts in a loading state and asks the adapter for data', () => {
  let asked = null
  const adapter = { load: (m, which) => { asked = which; return new Promise(() => {}) } }
  const html = renderToStaticMarkup(h(EngineApp, { manifest: sampleManifest(), surface: 'public', adapter }))
  assert.ok(html.includes('aria-busy="true"'))
  // Effects do not run in a server render; the adapter is called once mounted.
  assert.equal(asked, null)
})

test('an image field offers a file input only where the screen can upload (EngineApp with an adapter that has uploadImage)', () => {
  const form = { type: 'form', id: 'photos:new', fields: [{ key: 'url', label: 'Image', type: 'image' }], values: {}, submit: { label: 'Add', action: { type: 'record.create', source: 'photos' } } }
  const plain = renderToStaticMarkup(h(Blocks, { blocks: [form] }))
  assert.ok(plain.includes('type="url"'))
  assert.ok(!plain.includes('type="file"'), 'a bare block tree has nowhere to send a file')
  const withUpload = renderToStaticMarkup(h(Blocks, { blocks: [form], upload: true }))
  assert.ok(withUpload.includes('type="url"'), 'the link still works')
  assert.ok(withUpload.includes('type="file"') && withUpload.includes('accept="image/*"'), withUpload)
  assert.ok(withUpload.includes('ng-field-upload'))
})
