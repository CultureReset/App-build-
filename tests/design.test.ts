import assert from 'node:assert/strict'
import { test } from 'node:test'
import { embedSrc } from '../src/lib/runtime/embeds.ts'
import { coerceTheme, defaultTheme, themeSchema, themeToCssVars, contrastOn, THEME_PRESETS } from '../src/lib/theme/spec.ts'
import { BUILTIN_TEMPLATES, pageTemplateSchema } from '../src/lib/theme/templates.ts'
import { TEMPLATE_VARIANTS, resolveVariant, safeParseManifest } from '../src/lib/modules/spec.ts'
import listings from '../src/modules/listings/manifest.ts'
import video from '../src/modules/video/manifest.ts'
import actionButtons from '../src/modules/action-buttons/manifest.ts'

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

test('a built-in layout only names modules that exist and can be public', async () => {
  const { getBuiltinModule } = await import('../src/lib/modules/builtins.ts')

  for (const template of BUILTIN_TEMPLATES) {
    for (const block of template.plan) {
      const manifest = getBuiltinModule(block.module_id)

      assert.ok(manifest, `${template.slug} names unknown module "${block.module_id}"`)
      assert.ok(
        manifest.publicSurface,
        `${template.slug} names "${block.module_id}", which has no public surface`,
      )
    }
  }
})

test('a built-in layout only uses variants its template supports', () => {
  for (const template of BUILTIN_TEMPLATES) {
    for (const block of template.plan) {
      if (!block.display_variant) continue

      const surface =
        block.module_id === 'listings'
          ? listings.publicSurface
          : block.module_id === 'video'
            ? video.publicSurface
            : block.module_id === 'action-buttons'
              ? actionButtons.publicSurface
              : undefined

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
