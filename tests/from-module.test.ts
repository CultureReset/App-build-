import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkBlocks, renderOwner, renderPublic, toStorePublication, validateManifest } from '@nextgent/app-engine'
import { BUILTIN_MODULES } from '../src/lib/modules/builtins.ts'
import { engineId, engineManifestFromModule } from '../src/lib/engine/from-module.ts'
import { manifestFromDraft, draftFromManifest } from '../src/lib/modules/derive.ts'

/**
 * The builder (manual and describe-it) still edits App-build-'s module
 * draft; what it hands the store is this conversion. Every app the builder
 * can express — every built-in, by the round-trip test in builder.test.ts —
 * must come out as a valid engine manifest and store release.
 */
for (const builtin of BUILTIN_MODULES) {
  test(`${builtin.id} converts to a valid engine manifest`, () => {
    const manifest = engineManifestFromModule(builtin, { publisher: 'tester' })
    const result = validateManifest(manifest)
    assert.deepEqual(result.errors, [], builtin.id)
    assert.equal(toStorePublication(manifest).ok, true)
    assert.deepEqual(checkBlocks(renderOwner(manifest, {}, {})), [])
    assert.deepEqual(checkBlocks(renderPublic(manifest, {}, {})), [])
    assert.equal(manifest.surfaces!.some((s) => s.kind === 'public'), Boolean(builtin.publicSurface))
  })
}

test('a draft from the builder converts the same way', () => {
  const draft = draftFromManifest(BUILTIN_MODULES[0])
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
  const songs = BUILTIN_MODULES.find((m) => m.publicSurface?.template === 'form')!
  const manifest = engineManifestFromModule(songs, { publisher: 'tester' })
  const table = Object.values(manifest.data!.tables!)[0]
  assert.equal(table.public, 'append')
  const form = renderPublic(manifest, {}, {}).flatMap((s) => ('blocks' in s ? s.blocks : [])).find((b) => b.type === 'form')
  assert.ok(form && form.type === 'form')
  const ownerOnly = Object.values(manifest.ui!.sources).flatMap((s) => s.fields.filter((f) => f.ownerOnly).map((f) => f.key))
  assert.ok(ownerOnly.length > 0)
  for (const key of ownerOnly) assert.ok(!form.fields.some((f) => f.key === key))
})
