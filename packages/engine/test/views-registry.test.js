import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { validateManifest, renderPublic, renderOwner, renderHtml, checkBlocks, walkBlocks, VIEW_TYPES, BLOCK_TYPES, viewModules, viewModule, registerView, unregisterView, checkViewModule } from '../src/index.js'
import { templatesManifest, templatesData } from './fixtures.js'

// Every template is one module under src/views/ (owner's rule: everything
// modular). They share the block primitives, the helpers and the tokens, and
// nothing else: one can be removed from the registry and the rest still work.

const viewsDir = path.resolve(import.meta.dirname, '..', 'src', 'views')
const NAMES = viewModules().map((m) => m.name)

test('each template module exports the same interface and has its own stylesheet', () => {
  assert.ok(NAMES.length >= 7, 'the public group at least')
  assert.equal(new Set(NAMES).size, NAMES.length)
  for (const mod of viewModules()) {
    assert.deepEqual(checkViewModule(mod), [], mod.name)
    assert.ok(readdirSync(viewsDir).includes(`${mod.name}.js`), `${mod.name}.js`)
    const css = readFileSync(path.join(viewsDir, `${mod.name}.css`), 'utf8')
    for (const token of mod.tokens) assert.ok(css.includes(token), `${mod.name}.css declares ${token}`)
    assert.ok(VIEW_TYPES[mod.name], `${mod.name} is a view type`)
    assert.equal(Boolean(VIEW_TYPES[mod.name].owner), mod.surface === 'owner')
  }
  const styles = readFileSync(path.resolve(viewsDir, '..', 'styles.css'), 'utf8')
  for (const name of NAMES) assert.ok(styles.includes(`./views/${name}.css`), `styles.css imports ${name}.css`)
})

test('no template module imports another, except a shared helper it re-exports from (listings, availability)', () => {
  for (const name of NAMES) {
    const code = readFileSync(path.join(viewsDir, `${name}.js`), 'utf8')
    const imports = [...code.matchAll(/from '\.\/([a-z-]+)\.js'/g)].map((m) => m[1])
    const allowed = { 'listing-manager': ['listings'], 'availability-calendar': ['availability'] }[name] || []
    assert.deepEqual(imports, allowed, `${name} imports ${imports.join(', ')}`)
    assert.ok(!code.includes("from './index.js'"), `${name} does not reach into the registry`)
  }
})

test('the registry refuses a malformed module and a block two templates would both own', () => {
  assert.throws(() => registerView({ name: 'Bad Name' }), /not well formed/)
  assert.throws(() => registerView({ name: 'other', surface: 'public', summary: 'x', spec: { slots: [] }, tokens: [], render: () => [], blocks: { profile: { check() {}, html: () => '', react: () => null } } }), /already owns/)
})

for (const removed of NAMES) {
  test(`removing "${removed}" from the registry leaves every other template working`, () => {
    const mod = viewModule(removed)
    const m = templatesManifest() // built while every template is registered, so it still names the one removed
    assert.ok(unregisterView(removed))
    try {
      assert.equal(VIEW_TYPES[removed], undefined)
      assert.ok(!Object.keys(VIEW_TYPES).includes(removed))
      const errors = validateManifest(m).errors
      const offered = errors.find((e) => e.message.includes('must be one of'))
      assert.ok(offered && !offered.message.replace(/\.$/, '').split('must be one of ')[1].split(', ').includes(removed), 'the removed type is refused and not offered')
      assert.equal(errors.length, 1, `only the removed view fails: ${JSON.stringify(errors)}`)
      // Without that view, the rest validates, renders and draws.
      for (const set of ['owner', 'public']) m.ui.views[set] = m.ui.views[set].filter((v) => v.type !== removed)
      assert.deepEqual(validateManifest(m).errors, [])
      const pub = renderPublic(m, {}, templatesData(), {}, { now: Date.parse('2026-03-10T12:00:00Z'), locale: 'en-US' })
      const own = renderOwner(m, {}, templatesData(), {}, { now: Date.parse('2026-03-10T12:00:00Z'), locale: 'en-US' })
      assert.deepEqual(checkBlocks(pub), [])
      assert.deepEqual(checkBlocks(own), [])
      assert.ok(renderHtml(pub).length > 0 && renderHtml(own).length > 0)
      for (const b of walkBlocks([...pub, ...own])) assert.ok(BLOCK_TYPES.includes(b.type), b.type)
      if (mod.blocks) for (const type of Object.keys(mod.blocks)) assert.ok(!BLOCK_TYPES.includes(type), `block "${type}" leaves with its template`)
    } finally {
      registerView(mod)
    }
    assert.ok(VIEW_TYPES[removed])
    assert.deepEqual(validateManifest(templatesManifest()).errors, [])
  })
}
