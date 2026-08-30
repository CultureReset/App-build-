import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AI_PROVIDERS, PROVIDER_ORDER, getProvider, providerIdSchema } from '../src/lib/ai/providers.ts'
import { resolveModel } from '../src/lib/ai/resolve-model.ts'
import { platformDefaultConfig } from '../src/lib/ai/resolve-config.ts'

/**
 * The provider layer is the "any API, any AI" seam: these tests hold it to
 * being genuinely data-driven (no provider gets special-cased logic the
 * others lack) and prove the platform-default resolver only ever activates
 * when its own environment variables are actually set — never by accident,
 * and never favouring one provider when several could apply.
 */
test('every registered provider is reachable from its own id', () => {
  for (const id of PROVIDER_ORDER) {
    assert.equal(getProvider(id)?.id, id)
  }
})

test('an unknown provider id resolves to nothing', () => {
  assert.equal(getProvider('made-up-provider'), undefined)
  assert.equal(providerIdSchema.safeParse('made-up-provider').success, false)
})

test('every compatible provider other than "custom" has a fixed base URL', () => {
  for (const id of PROVIDER_ORDER) {
    const provider = AI_PROVIDERS[id]

    if (provider.kind === 'compatible' && id !== 'custom') {
      assert.ok(provider.baseURL, `${id} should ship with a known endpoint`)
    }
  }
})

test('only "custom" requires the caller to supply a base URL', () => {
  for (const id of PROVIDER_ORDER) {
    assert.equal(Boolean(AI_PROVIDERS[id].needsBaseUrl), id === 'custom')
  }
})

test('resolveModel refuses a custom provider with no base URL', () => {
  assert.throws(() => resolveModel({ provider: 'custom' }))
})

test('resolveModel accepts a custom provider once a base URL is given', () => {
  assert.doesNotThrow(() =>
    resolveModel({ provider: 'custom', baseURL: 'https://example.com/v1', apiKey: 'x' }),
  )
})

test('resolveModel builds a model for every native and named-compatible provider', () => {
  const configs: Parameters<typeof resolveModel>[0][] = [
    { provider: 'anthropic', apiKey: 'x' },
    { provider: 'openai', apiKey: 'x' },
    { provider: 'google', apiKey: 'x' },
    { provider: 'openrouter', apiKey: 'x' },
  ]

  for (const config of configs) {
    assert.doesNotThrow(() => resolveModel(config), `${config.provider} should not throw`)
  }
})

test('the platform default only activates from its own environment variables', () => {
  const saved = { ...process.env }

  for (const key of Object.keys(process.env)) {
    if (key.endsWith('_API_KEY') || key.endsWith('_BASE_URL')) {
      delete process.env[key]
    }
  }

  assert.equal(platformDefaultConfig(), null)

  process.env.OPENAI_API_KEY = 'sk-test'
  assert.deepEqual(platformDefaultConfig(), {
    provider: 'openai',
    apiKey: 'sk-test',
    baseURL: undefined,
    model: undefined,
  })

  process.env = saved
})

test('the platform default prefers whichever provider is first configured, in registry order', () => {
  const saved = { ...process.env }

  for (const key of Object.keys(process.env)) {
    if (key.endsWith('_API_KEY') || key.endsWith('_BASE_URL')) {
      delete process.env[key]
    }
  }

  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'g-test'
  process.env.OPENROUTER_API_KEY = 'or-test'

  const resolved = platformDefaultConfig()
  assert.equal(resolved?.provider, 'google')

  process.env = saved
})
