import type { SupabaseClient } from '@supabase/supabase-js'
import { AI_PROVIDERS, PROVIDER_ORDER, getProvider } from '@/lib/ai/providers'
import type { ProviderConfig } from '@/lib/ai/resolve-model'

export type ResolvedConfig = { config: ProviderConfig; source: 'personal' | 'platform' }

type CredentialRow = {
  provider: string
  api_key: string | null
  base_url: string | null
  model: string | null
}

/** A platform-wide default, read from environment variables, with no database involved. */
export function platformDefaultConfig(): ProviderConfig | null {
  for (const id of PROVIDER_ORDER) {
    const definition = AI_PROVIDERS[id]
    const apiKey = definition.env.apiKeyVar ? process.env[definition.env.apiKeyVar] : undefined
    const baseURL = definition.env.baseUrlVar
      ? process.env[definition.env.baseUrlVar]
      : definition.baseURL

    if (definition.needsBaseUrl && !baseURL) {
      continue
    }

    if (!definition.needsBaseUrl && !apiKey) {
      continue
    }

    return {
      provider: id,
      apiKey,
      baseURL,
      model: definition.env.modelVar ? process.env[definition.env.modelVar] : undefined,
    }
  }

  return null
}

/**
 * Resolves which AI provider a generation call should use.
 *
 * A signed-in account's own credential always wins over the deployment's
 * platform-wide default — "bring your own key" means every account can point
 * generation at whatever provider they choose, independent of anyone else's
 * configuration, including the platform operator's.
 */
export async function resolveProviderConfig(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedConfig | null> {
  const { data } = await supabase
    .from('ai_credentials')
    .select('provider, api_key, base_url, model')
    .eq('user_id', userId)
    .maybeSingle<CredentialRow>()

  if (data) {
    const definition = getProvider(data.provider)

    if (definition) {
      return {
        source: 'personal',
        config: {
          provider: definition.id,
          apiKey: data.api_key ?? undefined,
          baseURL: data.base_url ?? undefined,
          model: data.model ?? undefined,
        },
      }
    }
  }

  const platform = platformDefaultConfig()
  return platform ? { source: 'platform', config: platform } : null
}

export async function aiAvailability(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return (await resolveProviderConfig(supabase, userId)) !== null
}
