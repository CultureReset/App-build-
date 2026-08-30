import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { platformDefaultConfig } from '@/lib/ai/resolve-config'
import { providerIdSchema } from '@/lib/ai/providers'
import AiProviderSettings, { type CurrentCredential } from '@/components/settings/AiProviderSettings'
import type { AiCredentialRow } from '@/lib/supabase/types'

export const metadata = { title: 'AI provider' }
export const dynamic = 'force-dynamic'

export default async function AiSettingsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // The key is read here only to test whether one exists; the value itself
  // never leaves this server component — only a boolean crosses into props.
  const { data: row } = await supabase
    .from('ai_credentials')
    .select('provider, base_url, model, api_key')
    .eq('user_id', user.id)
    .maybeSingle<AiCredentialRow>()

  const parsedProvider = row ? providerIdSchema.safeParse(row.provider) : null

  const current: CurrentCredential =
    row && parsedProvider?.success
      ? {
          provider: parsedProvider.data,
          baseUrl: row.base_url,
          model: row.model,
          hasKey: Boolean(row.api_key),
        }
      : null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">AI provider</h1>
        <p className="mt-1 text-sm text-ink-500">
          What generates an app when you describe or speak it. Any provider, your own key — this
          setting is entirely yours and has nothing to do with anyone else&rsquo;s account.
        </p>
      </div>

      <AiProviderSettings current={current} platformAvailable={Boolean(platformDefaultConfig())} />
    </div>
  )
}
