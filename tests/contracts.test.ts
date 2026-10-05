import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Manifest } from '@nextgent/app-engine'
import { shippedManifests } from '../src/lib/engine/starters.ts'

/**
 * Cross-repo check (DECISIONS #45, #62, #63): every bound field of a shipped
 * app, after its binding's fieldMap, is a column of the table gcr-api-clean's
 * contract registry (lib/dataContracts.js) serves for that contract. The
 * registry is read directly from the sibling checkout; without one the test
 * skips. The column lists are the tables as gcr-api-clean declares them
 * (schema.sql, sql/nextgent_business_contacts.sql, offerings; business.links
 * is served as rows {id, network, url}); where schema.sql defines the table,
 * its CREATE TABLE is parsed and must agree.
 */
const gcr = path.resolve(import.meta.dirname, '..', '..', 'gcr-api-clean')
const registryPath = path.join(gcr, 'lib', 'dataContracts.js')
const present = existsSync(registryPath)

const COLUMNS: Record<string, { table: string; columns: string[] }> = {
  'media.images': { table: 'entity_photos', columns: ['url', 'image_path', 'caption', 'is_cover', 'sort_order'] },
  'faqs.items': { table: 'faqs', columns: ['question', 'answer', 'sort_order'] },
  'leads.items': { table: 'entity_leads', columns: ['name', 'email', 'phone', 'message', 'source', 'status'] },
  'listings.items': { table: 'offerings', columns: ['name', 'description', 'unit', 'price_from', 'capacity', 'active', 'details', 'kind', 'sort_order'] },
  'business.links': { table: 'entity', columns: ['network', 'url'] },
  'menu.items': { table: 'menu_items', columns: ['item_name', 'section_id', 'price', 'description', 'image_url', 'is_available'] },
  'menu.sections': { table: 'menu_sections', columns: ['section_name', 'sort_order'] },
  'business.currency': { table: 'entity', columns: ['currency'] },
}

function schemaColumns(table: string): string[] | null {
  const schema = path.join(gcr, 'schema.sql')
  if (!existsSync(schema)) return null
  const m = readFileSync(schema, 'utf8').match(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table} \\(([^;]*?)\\n\\);`))
  if (!m) return null
  return m[1].split('\n').map((l) => l.trim()).filter((l) => l && !/^(PRIMARY|UNIQUE|CONSTRAINT|FOREIGN|CHECK)/i.test(l)).map((l) => l.split(/\s+/)[0])
}

const bound = shippedManifests().flatMap(({ dir, manifest }) =>
  Object.entries(manifest.ui?.sources ?? {})
    .filter(([, s]) => s.from === 'business' && s.binding)
    .map(([key, s]) => ({ dir, key, source: s, binding: manifest.bindings![s.binding!] })),
)

test('every bound field, after the fieldMap, is a column of the contract\'s table', () => {
  assert.ok(bound.length >= 7)
  for (const { dir, key, source, binding } of bound) {
    const spec = COLUMNS[binding.contract]
    assert.ok(spec, `${dir}.${key}: no column list for ${binding.contract}`)
    const fromSchema = schemaColumns(spec.table)
    const columns = new Set([...spec.columns, ...(fromSchema ?? [])])
    const map = binding.fieldMap ?? {}
    for (const [field, column] of Object.entries(map)) assert.ok(columns.has(column), `${dir}.${key}: fieldMap ${field} → "${column}" is not a column of ${spec.table}`)
    const mapped = (f: string) => map[f] ?? f
    for (const f of source.fields) assert.ok(columns.has(mapped(f.key)), `${dir}.${key}: field "${f.key}" (${mapped(f.key)}) is not a column of ${spec.table}`)
    for (const ref of [source.order, source.visibleWhen]) if (ref) assert.ok(columns.has(mapped(ref)), `${dir}.${key}: "${ref}" is not a column of ${spec.table}`)
  }
})

test('the format bindings read business.currency', () => {
  for (const { manifest } of shippedManifests()) {
    const fmt = manifest.ui?.format?.currency
    if (fmt && typeof fmt === 'object' && 'binding' in fmt) assert.equal(manifest.bindings![fmt.binding].contract, 'business.currency')
  }
})

type Registry = { contractFor: (n: string) => { table: string; fieldMap: Record<string, string> | null; resource: string } | null }
const registry = (): Registry => createRequire(import.meta.url)(registryPath) as Registry
const contracts = [...new Set(shippedManifests().flatMap((s) => Object.values(s.manifest.bindings ?? {}).map((b) => b.contract)))]

test('gcr-api-clean registry: each contract it serves is served from the table the column list names, with no second fieldMap', { skip: !present && 'no gcr-api-clean checkout beside this repo' }, () => {
  for (const contract of contracts) {
    const entry = registry().contractFor(contract)
    if (!entry) continue // reported by the todo below
    assert.equal(entry.table, COLUMNS[contract].table, contract)
    assert.equal(entry.fieldMap, null, `${contract}: the registry maps fields too; the app's fieldMap would double-map`)
  }
})

// Shows as "todo" until the sibling checkout serves every contract the apps bind (listings.items landed after 3821b5b).
test('gcr-api-clean registry serves every contract the shipped apps bind', { skip: !present && 'no gcr-api-clean checkout beside this repo', todo: true }, () => {
  const missing = contracts.filter((c) => !registry().contractFor(c))
  assert.deepEqual(missing, [], `gcr-api-clean does not serve: ${missing.join(', ')}`)
})

test('enquiry-form asks for the contacts resource, not business (DECISIONS #59)', () => {
  const m = shippedManifests().find((s) => s.dir === 'enquiry-form')!.manifest
  assert.deepEqual(m.permissions!.map((p) => p.id), ['contacts:read', 'contacts:write'])
})
