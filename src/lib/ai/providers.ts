import { z } from 'zod'

/**
 * The provider registry: every AI backend this platform can call, described
 * as data rather than as a hardwired switch statement.
 *
 * This is the same lesson as the module catalogue — "why is this hardwired" —
 * applied to the AI layer. Adding a provider here is a registry entry plus
 * (for a native one) an npm package; it is never a rewrite of the calling
 * code, because every provider is turned into the same `LanguageModel`
 * interface by the Vercel AI SDK before generation ever runs.
 *
 * Two provider "kinds" cover the space:
 *  - native:  a first-party SDK package (Anthropic, OpenAI, Google).
 *  - compatible: any endpoint that speaks the OpenAI chat-completions wire
 *    format — which by now is most of the industry, including self-hosted
 *    runners (Ollama, LM Studio, vLLM), aggregators (OpenRouter, Together),
 *    and enterprise deployments (Azure OpenAI). One adapter, unlimited
 *    providers, including ones this file has never heard of: "custom" takes
 *    any base URL at all.
 */
export const providerIdSchema = z.enum(['anthropic', 'openai', 'google', 'openrouter', 'custom'])

export type ProviderId = z.infer<typeof providerIdSchema>

export type ProviderDefinition = {
  id: ProviderId
  label: string
  kind: 'native' | 'compatible'
  /** Fixed for a compatible provider with a known endpoint; absent for "custom", which asks the user. */
  baseURL?: string
  /** Whether this provider requires a base URL from whoever configures it. */
  needsBaseUrl?: boolean
  defaultModel: string
  keyHelp: string
  keyUrl: string
  /**
   * Environment variables that give this deployment a platform-wide default,
   * used only when the signed-in account has not set their own credential.
   */
  env: { apiKeyVar?: string; baseUrlVar?: string; modelVar?: string }
}

export const AI_PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'native',
    defaultModel: 'claude-sonnet-5',
    keyHelp: 'Create a key in the Anthropic Console.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    env: { apiKeyVar: 'ANTHROPIC_API_KEY', modelVar: 'ANTHROPIC_MODEL' },
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT)',
    kind: 'native',
    defaultModel: 'gpt-5.1',
    keyHelp: 'Create a key in the OpenAI dashboard.',
    keyUrl: 'https://platform.openai.com/api-keys',
    env: { apiKeyVar: 'OPENAI_API_KEY', modelVar: 'OPENAI_MODEL' },
  },
  google: {
    id: 'google',
    label: 'Google (Gemini)',
    kind: 'native',
    defaultModel: 'gemini-3-pro',
    keyHelp: 'Create a key in Google AI Studio.',
    keyUrl: 'https://aistudio.google.com/apikey',
    env: { apiKeyVar: 'GOOGLE_GENERATIVE_AI_API_KEY', modelVar: 'GOOGLE_MODEL' },
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (any model)',
    kind: 'compatible',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-5',
    keyHelp:
      'One key, hundreds of models from every major lab. The simplest way to try a model not listed here.',
    keyUrl: 'https://openrouter.ai/keys',
    env: { apiKeyVar: 'OPENROUTER_API_KEY', modelVar: 'OPENROUTER_MODEL' },
  },
  custom: {
    id: 'custom',
    label: 'Custom endpoint',
    kind: 'compatible',
    needsBaseUrl: true,
    defaultModel: '',
    keyHelp:
      'Any server that speaks the OpenAI chat-completions format — a self-hosted model (Ollama, LM Studio, vLLM), Azure OpenAI, or another aggregator. Provide its base URL and, if it needs one, a key.',
    keyUrl: '',
    env: {
      apiKeyVar: 'CUSTOM_AI_API_KEY',
      baseUrlVar: 'CUSTOM_AI_BASE_URL',
      modelVar: 'CUSTOM_AI_MODEL',
    },
  },
}

export const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'openai', 'google', 'openrouter', 'custom']

export function getProvider(id: string): ProviderDefinition | undefined {
  const parsed = providerIdSchema.safeParse(id)
  return parsed.success ? AI_PROVIDERS[parsed.data] : undefined
}
