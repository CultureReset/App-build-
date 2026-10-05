import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkBlocks, renderOwner, renderPublic, toStorePublication, validateManifest, type Manifest } from '@nextgent/app-engine'
import { shippedManifests, draftFromEngineManifest } from '../src/lib/engine/starters.ts'
import { engineId, engineManifestFromModule } from '../src/lib/engine/from-module.ts'
import { manifestFromDraft } from '../src/lib/modules/derive.ts'

/**
 * One definition per app (DECISIONS #42): the builder starts from the engine
 * manifests in apps/<name>/manifest.json. Every shipped app must survive the
 * trip engine manifest → builder draft → engine manifest with its data model
 * intact: its own tables, its business bindings and the permissions they
 * imply, and its public face.
 */
const shipped = shippedManifests()

test('the shipped apps are loaded from apps/*/manifest.json', () => {
  assert.ok(shipped.length >= 10)
  for (const { dir, manifest } of shipped) assert.equal(validateManifest(manifest).ok, true, dir)
  assert.ok(shipped.some((s) => s.dir === 'qr-menu'))
})

function roundTrip(manifest: Manifest): Manifest {
  const draft = draftFromEngineManifest(manifest)
  return engineManifestFromModule(manifestFromDraft(draft), { publisher: manifest.publisher, id: manifest.id })
}

for (const { dir, manifest } of shipped) {
  test(`${dir}: draft → engine manifest keeps the data model and validates`, () => {
    const back = roundTrip(manifest)
    const result = validateManifest(back)
    assert.deepEqual(result.errors, [], dir)
    assert.equal(toStorePublication(back).ok, true)
    assert.deepEqual(checkBlocks(renderOwner(back, {}, {})), [])
    assert.deepEqual(checkBlocks(renderPublic(back, {}, {})), [])
    // Same tables and columns (names), same public access.
    const tablesOf = (m: Manifest) => Object.fromEntries(Object.entries(m.data?.tables ?? {}).map(([k, t]) => [k, { columns: Object.keys(t.columns).sort(), public: t.public ?? 'none' }]))
    assert.deepEqual(tablesOf(back), tablesOf(manifest), `${dir} tables`)
    // Same bindings, and the same sources bound to them.
    assert.deepEqual(back.bindings ?? {}, manifest.bindings ?? {}, `${dir} bindings`)
    const boundOf = (m: Manifest) => Object.fromEntries(Object.entries(m.ui!.sources).map(([k, s]) => [k, s.from === 'business' ? `business:${s.binding}` : `app:${s.table}`]))
    assert.deepEqual(boundOf(back), boundOf(manifest), `${dir} sources`)
    // Same permissions, with their reasons.
    assert.deepEqual(back.permissions ?? [], manifest.permissions ?? [], `${dir} permissions`)
    // Same fields (keys and types), including select options with their icons and optionsFrom.
    for (const [key, s] of Object.entries(manifest.ui!.sources)) {
      const fieldsOf = (src: typeof s) => src.fields.map((f) => ({ key: f.key, type: f.type, options: f.options, optionsFrom: f.optionsFrom, ownerOnly: f.ownerOnly ?? undefined }))
      assert.deepEqual(fieldsOf(back.ui!.sources[key]), fieldsOf(s), `${dir}.${key} fields`)
    }
    assert.equal(back.surfaces!.some((s) => s.kind === 'public'), manifest.surfaces!.some((s) => s.kind === 'public'))
    assert.deepEqual(back.ui!.format, manifest.ui!.format, `${dir} format`)
  })
}

test('the builder learns business sources: a bound collection becomes a from:business source with its permissions', () => {
  const menu = shipped.find((s) => s.dir === 'qr-menu')!.manifest
  const draft = draftFromEngineManifest(menu)
  assert.ok(draft.bindings && Object.keys(draft.bindings).length > 0, 'qr-menu is bound to the business menu')
  const bound = Object.values(draft.collections).filter((c) => c.binding)
  assert.equal(bound.length, 2, 'both collections name their binding')
  const back = roundTrip(menu)
  for (const source of Object.values(back.ui!.sources)) assert.equal(source.from, 'business')
  assert.deepEqual(back.permissions!.map((p) => p.id), ['menu:read', 'menu:write'])
  assert.equal(back.data, undefined, 'no app table for business data')
})

test('a draft from the builder converts the same way', () => {
  const draft = draftFromEngineManifest(shipped.find((s) => s.dir === 'link-hub')!.manifest)
  const manifest = engineManifestFromModule(manifestFromDraft({ ...draft, name: 'My Things' }), { publisher: 'Some Author' })
  assert.equal(manifest.id, 'some-author-my-things')
  assert.equal(manifest.publisher, 'some-author')
  assert.equal(validateManifest(manifest).ok, true)
})

test('ids are publisher-prefixed store keys', () => {
  assert.equal(engineId('acme', 'Table Bookings!'), 'acme-table-bookings')
  assert.equal(engineId('acme', '***'), 'acme-app')
})

test('public writes become an append-only table; owner-only fields stay owner-only', () => {
  const songs = roundTrip(shipped.find((s) => s.dir === 'song-requests')!.manifest)
  const table = Object.values(songs.data!.tables!)[0]
  assert.equal(table.public, 'append')
  const form = renderPublic(songs, {}, {}).flatMap((s) => ('blocks' in s ? s.blocks : [])).find((b) => b.type === 'form')
  assert.ok(form && form.type === 'form')
  const ownerOnly = Object.values(songs.ui!.sources).flatMap((s) => s.fields.filter((f) => f.ownerOnly).map((f) => f.key))
  assert.ok(ownerOnly.length > 0)
  for (const key of ownerOnly) assert.ok(!form.fields.some((f) => f.key === key))
})
