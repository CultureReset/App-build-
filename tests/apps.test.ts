import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  checkBlocks,
  renderHtml,
  renderOwner,
  renderPublic,
  toStorePublication,
  validateManifest,
  type Field,
  type Manifest,
  type Rows,
} from '@nextgent/app-engine'
import { Blocks } from '@nextgent/app-engine/react'

/**
 * Every app App-build- shipped, converted to an engine manifest (apps/<name>/manifest.json).
 * Each must validate against app-manifest v1 + the store rules + the engine,
 * become a Paperclip store release, and draw on the owner screen and the
 * public block through both renderers, from rows made up from field types.
 */
const root = path.resolve(import.meta.dirname, '..')
const appsDir = path.join(root, 'apps')
const names = readdirSync(appsDir).filter((n) => !n.startsWith('.') && statSync(path.join(appsDir, n)).isDirectory())
const load = (name: string) => JSON.parse(readFileSync(path.join(appsDir, name, 'manifest.json'), 'utf8')) as Manifest

function sampleValue(field: Field, i: number, data: Rows): unknown {
  switch (field.type) {
    case 'number': return i + 2
    case 'money': return 10 + i + 0.5
    case 'boolean': return true
    case 'select': {
      if (field.options?.length) return field.options[i % field.options.length].value
      const rows = field.optionsFrom ? data[field.optionsFrom.source] ?? [] : []
      return rows[i % Math.max(rows.length, 1)]?.id ?? null
    }
    case 'date': return '2026-01-0' + (i + 1)
    case 'time': return '1' + i + ':00'
    case 'email': return `person${i}@example.test`
    case 'phone': return '+1 555 010' + i
    case 'url':
    case 'image': return `https://media.example.test/${field.key}/${i}`
    case 'color': return '#336699'
    default: return `${field.label} ${i}`
  }
}

function sampleRows(manifest: Manifest): Rows {
  const data: Rows = {}
  const sources = Object.entries(manifest.ui?.sources ?? {})
  // Sources others draw options from go first.
  sources.sort(([, a], [, b]) => Number(a.fields.some((f) => f.optionsFrom)) - Number(b.fields.some((f) => f.optionsFrom)))
  for (const [key, source] of sources) {
    data[key] = [0, 1, 2].map((i) => {
      const row: Record<string, unknown> = { id: `${key}-${i}`, created_at: `2026-01-0${i + 1}T00:00:00Z` }
      if (source.order) row[source.order] = i + 1
      for (const f of source.fields) row[f.key] = sampleValue(f, i, data)
      return row
    })
  }
  return data
}

test('there are twelve shipped apps with unique ids', () => {
  assert.equal(names.length, 12)
  const ids = names.map((n) => load(n).id)
  assert.equal(new Set(ids).size, ids.length)
})

for (const name of names) {
  test(`${name}: valid manifest, store release, owner and public drawing`, () => {
    const manifest = load(name)
    const checked = validateManifest(manifest, {
      item: { key: manifest.id, kind: 'app', name: manifest.name, publisher: manifest.publisher },
    })
    assert.deepEqual(checked.errors, [], `${name} must validate`)

    const publication = toStorePublication(manifest)
    assert.equal(publication.ok, true)
    if (publication.ok) {
      assert.equal(publication.item.key, manifest.id)
      assert.deepEqual(
        publication.version.payload.nextgent.permissions.map((p) => p.permission),
        (manifest.permissions ?? []).map((p) => p.id),
      )
    }

    const data = sampleRows(manifest)
    const owner = renderOwner(manifest, {}, data)
    assert.deepEqual(checkBlocks(owner), [])
    assert.ok(owner.length > 0, 'an owner screen')

    const publicBlocks = renderPublic(manifest, {}, data)
    assert.deepEqual(checkBlocks(publicBlocks), [])
    assert.ok(publicBlocks.length > 0, 'a public block')

    const html = renderHtml(publicBlocks)
    assert.ok(html.startsWith('<section'))
    const react = renderToStaticMarkup(createElement(Blocks, { blocks: owner }))
    assert.ok(react.includes('ng-section'))

    // Owner-only values never reach a visitor.
    const hidden = Object.values(manifest.ui?.sources ?? {}).flatMap((s) => s.fields.filter((f) => f.ownerOnly).map((f) => f.label))
    for (const label of hidden) assert.ok(!JSON.stringify(publicBlocks).includes(`"${label} `), label)
  })
}

test('nothing about any app lives in the engine', () => {
  const src = path.join(root, 'packages', 'engine', 'src')
  const code = readdirSync(src)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(path.join(src, f), 'utf8'))
    .join('\n')
  for (const name of names) {
    const m = load(name)
    const words = [m.id, m.name, ...Object.keys(m.ui?.sources ?? {}), ...Object.keys(m.data?.tables ?? {})]
    for (const s of Object.values(m.ui?.sources ?? {})) if (s.section) words.push(s.section)
    for (const w of words) assert.ok(!new RegExp(`['"\`]${w}['"\`]`).test(code), `engine code names "${w}" from ${name}`)
  }
})
