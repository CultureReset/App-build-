import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderHtml, renderPublic, renderOwner, escapeHtml } from '../src/index.js'
import { sampleManifest, sampleData, EMBEDS } from './fixtures.js'

test('escapes everything', () => {
  assert.equal(escapeHtml(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
  const html = renderHtml(renderPublic(sampleManifest(), {}, sampleData(), {}, { embeds: EMBEDS }))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
})

test('never emits a javascript: or data: URL, even from a hand-made block tree', () => {
  const html = renderHtml([
    { type: 'button', label: 'x', href: 'javascript:alert(1)' },
    { type: 'list', style: 'list', items: [{ title: 't', href: 'javascript:alert(2)', image: { src: 'data:x', alt: '' } }] },
    { type: 'image', src: 'javascript:alert(3)', alt: 'a' },
    { type: 'embed', src: 'http://insecure.example.test', title: 'x' },
  ])
  assert.ok(!html.includes('javascript:'))
  assert.ok(!html.includes('data:x'))
  assert.ok(!html.includes('<iframe'))
})

test('draws every public block type', () => {
  const html = renderHtml(renderPublic(sampleManifest(), { currency: 'EUR' }, sampleData(), {}, { embeds: EMBEDS, locale: 'en-US' }))
  for (const needle of ['ng-section', 'ng-list--list', 'ng-list--cards', 'ng-buttons--icons', 'ng-images--grid', 'ng-details--accordion', '<iframe', 'ng-form', 'ng-text', '€12.50']) {
    assert.ok(html.includes(needle), needle)
  }
  assert.ok(html.includes('sandbox="'))
})

test('forms post where the screen says, or are inert', () => {
  const blocks = renderPublic(sampleManifest(), {}, sampleData())
  const inert = renderHtml(blocks)
  assert.ok(/<form class="ng-form">/.test(inert))
  assert.ok(inert.includes('disabled>'))
  const live = renderHtml(blocks, { formAction: (action) => `/submit/${action.source}` })
  assert.ok(live.includes('method="post" action="/submit/notes"'))
})

test('owner blocks draw too (tables, notices), with a custom prefix', () => {
  const html = renderHtml(renderOwner(sampleManifest(), {}, sampleData(), { granted: ['things:read'] }), { prefix: 'app' })
  assert.ok(html.includes('<table class="app-table">'))
  assert.ok(html.includes('app-notice'))
  assert.ok(!html.includes('class="ng-'))
})

test('unknown block types are skipped', () => {
  assert.equal(renderHtml([{ type: 'hologram' }, { type: 'divider' }]), '<hr class="ng-divider">')
})

test('enumerated block props (tone, style, field type, heading level) are whitelisted, never interpolated raw', () => {
  const payload = '" onmouseover="alert(1)'
  const html = renderHtml([
    { type: 'text', text: 't', tone: payload },
    { type: 'notice', text: 'n', tone: payload },
    { type: 'heading', text: 'h', level: payload },
    { type: 'list', style: payload, items: [{ title: 'a' }] },
    { type: 'images', style: payload, items: [{ src: 'https://img.example.test/1.png', alt: 'a' }] },
    { type: 'button', label: 'b', href: 'https://example.test', style: payload },
    { type: 'buttons', style: payload, items: [{ label: 'b', href: 'https://example.test' }] },
    { type: 'details', style: payload, items: [{ summary: 's', body: 'b' }] },
    { type: 'form', id: 'f', style: payload, fields: [{ key: 'k', label: 'K', type: payload }], values: {}, submit: { label: 'Go', action: { type: 'form.submit' } } },
  ])
  assert.ok(!html.includes('onmouseover'), html)
  assert.ok(!html.includes(payload))
  assert.ok(!/<h(NaN|undefined)/.test(html))
  // Known values still come through as modifiers.
  const good = renderHtml([{ type: 'text', text: 't', tone: 'muted' }, { type: 'list', style: 'cards', items: [] }])
  assert.ok(good.includes('ng-text--muted') && good.includes('ng-list--cards'))
})
