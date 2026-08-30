'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProvider } from '@/lib/ai/providers'

export type ActionState = { error?: string; ok?: boolean }

async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { supabase, user }
}

/**
 * Saves the caller's own AI provider credential.
 *
 * Any account can point generation at any provider — this is the "modular
 * API" seam: nothing here favours one provider over another, and a custom
 * base URL is accepted as-is, so a self-hosted model works exactly like a
 * named one. Validation is deliberately narrow (shape and length only); the
 * credential is only ever proven correct by actually calling it.
 */
export async function saveAiCredential(input: {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}): Promise<ActionState> {
  const definition = getProvider(input.provider)

  if (!definition) {
    return { error: 'Unknown provider.' }
  }

  const baseUrl = input.baseUrl.trim()

  if (definition.needsBaseUrl && !baseUrl) {
    return { error: 'This provider needs a base URL.' }
  }

  if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
    return { error: 'The base URL must start with http:// or https://.' }
  }

  const { supabase, user } = await requireUser()

  const { error } = await supabase.from('ai_credentials').upsert({
    user_id: user.id,
    provider: definition.id,
    api_key: input.apiKey.trim() || null,
    base_url: definition.needsBaseUrl ? baseUrl : null,
    model: input.model.trim() || null,
  })

  if (error) {
    return { error: 'Could not save that provider.' }
  }

  revalidatePath('/dashboard/settings/ai')
  return { ok: true }
}

export async function clearAiCredential(): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  const { error } = await supabase.from('ai_credentials').delete().eq('user_id', user.id)

  if (error) {
    return { error: 'Could not remove that provider.' }
  }

  revalidatePath('/dashboard/settings/ai')
  return { ok: true }
}
