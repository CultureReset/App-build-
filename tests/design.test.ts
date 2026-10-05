import assert from 'node:assert/strict'
import { test } from 'node:test'
import { embedSrc } from '../src/lib/runtime/embeds.ts'
import { coerceTheme, defaultTheme, themeSchema, themeToCssVars, contrastOn, THEME_PRESETS } from '../src/lib/theme/spec.ts'
import { BUILTIN_TEMPLATES, pageTemplateSchema } from '../src/lib/theme/templates.ts'
import { TEMPLATE_VARIANTS, resolveVariant, safeParseManifest } from '../src/lib/modules/spec.ts'
import { manifestFromDraft } from '../src/lib/modules/derive.ts'
import { shippedManifests, draftFromEngineManifest } from '../src/lib/engine/starters.ts'

/**
 * The retired layouts (BUILTIN_TEMPLATES) name apps by their short id, which
 * is the directory under apps/ — one definition per app (DECISIONS #42).
 * The legacy starters' ids differ for two: lead-capture is apps/enquiry-form,
 * song-request is apps/song-requests.
 */
const shipped = shippedManifests()
const LEGACY_IDS: Record<string, string> = { 'lead-capture': 'enquiry-form', 'song-request': 'song-requests' }
const shippedApp = (id: string) => shipped.find((s) => s.dir === (LEGACY_IDS[id] ?? id))?.manifest
const moduleOf = (id: string) => manifestFromDraft(draftFromEngineManifest(shippedApp(id)!))
const listings = moduleOf('listings')

test('only YouTube and Vimeo can be embedded', () => {
  const rejected = [
    'https://evil.example.com/embed/x',
    'javascript:alert(1)',
    'data:text/html,<script>',
    'https://youtube.com.attacker.net/watch?v=abcdef',
    'https://vimeo.com/not-a-number',
    'not a url',
  ]

  for (const url of rejected) {
    assert.equal(embedSrc(url), null, `${url} should not be embeddable`)
  }
})

test('accepted video links are rewritten to a host we control', () => {
  assert.equal(
    embedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  )
  assert.equal(
    embedSrc('https://youtu.be/dQw4w9WgXcQ'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  )
  assert.equal(embedSrc('https://vimeo.com/347119375'), 'https://player.vimeo.com/video/347119375')
})

test('every theme preset satisfies the theme schema', () => {
  for (const preset of THEME_PRESETS) {
    assert.equal(themeSchema.safeParse(preset.theme).success, true, `${preset.id} is invalid`)
  }
})

test('an invalid theme falls back to the default rather than throwing', () => {
  assert.deepEqual(coerceTheme({ accent: 'not-a-colour' }), defaultTheme)
  assert.deepEqual(coerceTheme(null), defaultTheme)
  assert.deepEqual(coerceTheme('<script>'), defaultTheme)
})

test('a theme compiles to CSS variables with no unvalidated values', () => {
  const vars = themeToCssVars(coerceTheme({ accent: '#ff0000' }))

  assert.equal(vars['--pg-accent'], '#ff0000')
  // Nothing in the compiled output may carry CSS syntax that could break out.
  for (const value of Object.values(vars)) {
    assert.equal(/[;{}]|<\/?script/i.test(value), false, `unsafe value: ${value}`)
  }
})

test('foreground contrast flips with background luminance', () => {
  assert.equal(contrastOn('#ffffff'), '#12141a')
  assert.equal(contrastOn('#000000'), '#ffffff')
})

test('every built-in layout satisfies the layout schema', () => {
  for (const template of BUILTIN_TEMPLATES) {
    assert.equal(pageTemplateSchema.safeParse(template).success, true, `${template.slug} is invalid`)
  }
})

test('a built-in layout only names apps that ship and can be public', () => {
  for (const template of BUILTIN_TEMPLATES) {
    for (const block of template.plan) {
      const manifest = shippedApp(block.module_id)

      assert.ok(manifest, `${template.slug} names unknown app "${block.module_id}"`)
      assert.ok(
        manifest.surfaces?.some((s) => s.kind === 'public'),
        `${template.slug} names "${block.module_id}", which has no public surface`,
      )
    }
  }
})

test('a built-in layout only uses variants its template supports', () => {
  for (const template of BUILTIN_TEMPLATES) {
    for (const block of template.plan) {
      if (!block.display_variant) continue

      const surface = moduleOf(block.module_id).publicSurface
      if (!surface) continue

      assert.ok(
        TEMPLATE_VARIANTS[surface.template].includes(block.display_variant),
        `${template.slug}: "${block.display_variant}" is not valid for ${surface.template}`,
      )
    }
  }
})

test('an unsupported variant falls back rather than rendering nothing', () => {
  const surface = listings.publicSurface!

  assert.equal(resolveVariant(surface, 'accordion'), 'grid')
  assert.equal(resolveVariant(surface, null), 'grid')
  assert.equal(resolveVariant(surface, 'list'), 'list')
})

test('a manifest naming a variant its template cannot render is rejected', () => {
  const result = safeParseManifest({
    ...listings,
    publicSurface: { ...listings.publicSurface, defaultVariant: 'accordion' },
  })

  assert.equal(result.success, false)
})

test('a manifest whose surface points at a missing field is rejected', () => {
  const result = safeParseManifest({
    ...listings,
    publicSurface: { ...listings.publicSurface, imageField: 'no_such_field' },
  })

  assert.equal(result.success, false)
})
