import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BUILTIN_MODULES } from '../src/lib/modules/builtins.ts'
import {
  deriveManifest,
  draftFromManifest,
  nextVersion,
  validateDraft,
} from '../src/lib/modules/derive.ts'
import { TEMPLATE_INFO, TEMPLATE_ORDER } from '../src/lib/modules/templates.ts'
import { TEMPLATE_VARIANTS, type ModuleManifest } from '../src/lib/modules/spec.ts'

/**
 * The builder must be able to express everything the shipped apps express.
 * If a built-in cannot survive a round trip through the builder's draft shape,
 * then a user could not have built that app — which would mean the platform
 * still has privileged, hardwired apps.
 */
test('every built-in app round-trips through the builder unchanged', () => {
  for (const manifest of BUILTIN_MODULES) {
    const rebuilt = deriveManifest(draftFromManifest(manifest)) as ModuleManifest

    assert.deepEqual(
      rebuilt,
      manifest,
      `${manifest.id} is not reproducible from the builder's draft shape`,
    )
  }
})

test('a builder draft always produces a valid manifest', () => {
  for (const manifest of BUILTIN_MODULES) {
    const result = validateDraft(draftFromManifest(manifest))
    assert.equal(result.success, true, `${manifest.id} failed validation after a round trip`)
  }
})

test('permissions are derived from behaviour, not declared by the author', () => {
  const base = draftFromManifest(BUILTIN_MODULES.find((m) => m.id === 'faq')!)

  const headless = deriveManifest({ ...base, publicSurface: undefined }) as ModuleManifest
  assert.deepEqual(headless.permissions, ['store_records'])

  const published = deriveManifest(base) as ModuleManifest
  assert.ok(published.permissions.includes('public_page'))
  assert.ok(!published.permissions.includes('collect_submissions'))

  const collecting = deriveManifest({
    ...base,
    publicSurface: {
      template: 'form',
      collection: 'entries',
      submitCollection: 'entries',
    },
  }) as ModuleManifest
  assert.ok(collecting.permissions.includes('collect_submissions'))
})

test('a form collection is writable by visitors but never publicly readable', () => {
  const base = draftFromManifest(BUILTIN_MODULES.find((m) => m.id === 'lead-capture')!)
  const derived = deriveManifest(base) as ModuleManifest

  assert.equal(derived.collections.enquiries.publicWrite, true)
  assert.equal(derived.collections.enquiries.publicRead, false)
})

test('a headless app exposes no collection publicly', () => {
  const base = draftFromManifest(BUILTIN_MODULES.find((m) => m.id === 'listings')!)
  const derived = deriveManifest({ ...base, publicSurface: undefined }) as ModuleManifest

  for (const collection of Object.values(derived.collections)) {
    assert.equal(collection.publicRead, false)
    assert.equal(collection.publicWrite, false)
  }
})

test('every template the builder offers is one the runtime can render', () => {
  for (const template of TEMPLATE_ORDER) {
    assert.ok(TEMPLATE_INFO[template], `${template} has no builder description`)
    assert.ok(TEMPLATE_VARIANTS[template]?.length > 0, `${template} has no variants`)
  }

  assert.equal(
    TEMPLATE_ORDER.length,
    Object.keys(TEMPLATE_INFO).length,
    'a template exists that the builder never offers',
  )
})

test('version bumps behave', () => {
  assert.equal(nextVersion('1.0.0'), '1.0.1')
  assert.equal(nextVersion('1.4.9', 'minor'), '1.5.0')
  assert.equal(nextVersion('1.4.9', 'major'), '2.0.0')
})
