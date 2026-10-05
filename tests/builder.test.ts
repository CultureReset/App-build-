import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shippedManifests, draftFromEngineManifest } from '../src/lib/engine/starters.ts'
import { deriveManifest, draftFromManifest, nextVersion, validateDraft } from '../src/lib/modules/derive.ts'
import { TEMPLATE_INFO, TEMPLATE_ORDER } from '../src/lib/modules/templates.ts'
import { TEMPLATE_VARIANTS, type ModuleManifest } from '../src/lib/modules/spec.ts'

/**
 * The builder must be able to express everything the shipped apps express
 * (apps/<name>/manifest.json, DECISIONS #42). If a shipped app cannot survive
 * a round trip through the builder's draft shape, a user could not have built
 * it — which would mean the platform still has privileged, hardwired apps.
 */
const shipped = shippedManifests()
const draftOf = (dir: string) => draftFromEngineManifest(shipped.find((s) => s.dir === dir)!.manifest)

test('every shipped app becomes a draft the builder accepts, and round-trips through it unchanged', () => {
  for (const { dir, manifest } of shipped) {
    const draft = draftFromEngineManifest(manifest)
    const result = validateDraft(draft)
    assert.equal(result.success, true, `${dir}: ${result.success ? '' : result.error.issues[0]?.message}`)
    const derived = deriveManifest(draft) as ModuleManifest
    assert.deepEqual(draftFromManifest(derived), draft, `${dir} is not reproducible from the builder's draft shape`)
  }
})

test('permissions are derived from behaviour, not declared by the author', () => {
  const base = draftOf('faq')

  const headless = deriveManifest({ ...base, publicSurface: undefined }) as ModuleManifest
  assert.deepEqual(headless.permissions, ['store_records'])

  const published = deriveManifest(base) as ModuleManifest
  assert.ok(published.permissions.includes('public_page'))
  assert.ok(!published.permissions.includes('collect_submissions'))

  const [collectionKey] = Object.keys(base.collections)
  const collecting = deriveManifest({
    ...base,
    publicSurface: { template: 'form', collection: collectionKey, submitCollection: collectionKey },
  }) as ModuleManifest
  assert.ok(collecting.permissions.includes('collect_submissions'))
})

test('a form collection is writable by visitors but never publicly readable', () => {
  const derived = deriveManifest(draftOf('enquiry-form')) as ModuleManifest
  const [collection] = Object.values(derived.collections)
  assert.equal(collection.publicWrite, true)
  assert.equal(collection.publicRead, false)
})

test('a headless app exposes no collection publicly', () => {
  const derived = deriveManifest({ ...draftOf('listings'), publicSurface: undefined }) as ModuleManifest
  for (const collection of Object.values(derived.collections)) {
    assert.equal(collection.publicRead, false)
    assert.equal(collection.publicWrite, false)
  }
})

test('a collection bound to the business names a declared binding', () => {
  const base = draftOf('faq')
  const [key] = Object.keys(base.collections)
  const broken = validateDraft({ ...base, collections: { [key]: { ...base.collections[key], binding: 'nowhere' } } })
  assert.equal(broken.success, false)
})

test('every template the builder offers is one the runtime can render', () => {
  for (const template of TEMPLATE_ORDER) {
    assert.ok(TEMPLATE_INFO[template], `${template} has no builder description`)
    assert.ok(TEMPLATE_VARIANTS[template]?.length > 0, `${template} has no variants`)
  }
  assert.equal(TEMPLATE_ORDER.length, Object.keys(TEMPLATE_INFO).length, 'a template exists that the builder never offers')
})

test('version bumps behave', () => {
  assert.equal(nextVersion('1.0.0'), '1.0.1')
  assert.equal(nextVersion('1.4.9', 'minor'), '1.5.0')
  assert.equal(nextVersion('1.4.9', 'major'), '2.0.0')
})
