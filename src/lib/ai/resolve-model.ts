import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { AI_PROVIDERS, type ProviderId } from '@/lib/ai/providers'

export type ProviderConfig = {
  provider: ProviderId
  apiKey?: string
  /** Required for "custom"; ignored for every other provider (theirs is fixed). */
  baseURL?: string
  /** Falls back to the provider's own default model when omitted. */
  model?: string
}

/**
 * Turns a provider configuration into a single, uniform `LanguageModel`.
 *
 * This is the one place that knows five different SDKs exist. Everything past
 * this function — the prompt, the schema, the validation, the rate limiting —
 * is completely provider-agnostic, because generateObject takes the same
 * `LanguageModel` shape no matter which of these built it.
 */
export function resolveModel(config: ProviderConfig): LanguageModel {
  const definition = AI_PROVIDERS[config.provider]
  const modelId = config.model?.trim() || definition.defaultModel

  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey })(modelId)

    case 'openai':
      return createOpenAI({ apiKey: config.apiKey })(modelId)

    case 'google':
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(modelId)

    case 'openrouter':
      return createOpenAICompatible({
        name: 'openrouter',
        apiKey: config.apiKey,
        baseURL: definition.baseURL!,
      })(modelId)

    case 'custom': {
      const baseURL = config.baseURL?.trim()

      if (!baseURL) {
        throw new Error('A custom provider needs a base URL.')
      }

      return createOpenAICompatible({ name: 'custom', apiKey: config.apiKey, baseURL })(modelId)
    }
  }
}
