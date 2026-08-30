'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clearAiCredential, saveAiCredential } from '@/app/dashboard/settings/ai-actions'
import { AI_PROVIDERS, PROVIDER_ORDER, type ProviderId } from '@/lib/ai/providers'

export type CurrentCredential = {
  provider: ProviderId
  baseUrl: string | null
  model: string | null
  hasKey: boolean
} | null

/**
 * Lets any account plug in any AI provider — their own key, their own choice.
 *
 * This is deliberately not a single "connect Anthropic" button: the registry
 * this reads from (src/lib/ai/providers.ts) is the same one the generation
 * code resolves against, so adding a provider there is the only step needed
 * to offer it here too. The stored key is never sent back to the browser —
 * this form only ever knows whether one is set, never what it is.
 */
export default function AiProviderSettings({
  current,
  platformAvailable,
}: {
  current: CurrentCredential
  platformAvailable: boolean
}) {
  const router = useRouter()
  const [provider, setProvider] = useState<ProviderId>(current?.provider ?? 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(current?.baseUrl ?? '')
  const [model, setModel] = useState(current?.model ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const definition = AI_PROVIDERS[provider]

  function save() {
    startTransition(async () => {
      setError(null)
      setSaved(false)

      const result = await saveAiCredential({ provider, apiKey, baseUrl, model })

      if (result.error) {
        setError(result.error)
        return
      }

      setApiKey('')
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-medium">Your AI provider</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Powers &ldquo;Describe it&rdquo; when building an app. Bring your own key for any
          provider — nothing here is tied to one company&rsquo;s API.
        </p>

        {current ? (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Currently using <strong>{AI_PROVIDERS[current.provider].label}</strong>
            {current.hasKey ? '' : ' (no key stored)'}.
          </p>
        ) : platformAvailable ? (
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
            You have not set your own provider. This deployment&rsquo;s default is being used for
            now.
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No provider is set up — for you or for this deployment. Add one below to enable
            &ldquo;Describe it&rdquo;.
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDER_ORDER.map((id) => {
            const option = AI_PROVIDERS[id]

            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setProvider(id)
                  setSaved(false)
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  id === provider ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-500">
                  {option.keyHelp}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 space-y-3 border-t border-ink-100 pt-4">
          {definition.needsBaseUrl ? (
            <div>
              <label className="label" htmlFor="base-url">
                Base URL
              </label>
              <input
                id="base-url"
                className="field"
                value={baseUrl}
                placeholder="https://your-server.example.com/v1"
                disabled={pending}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="api-key">
              API key {definition.needsBaseUrl ? '(optional, if your endpoint needs one)' : ''}
            </label>
            <input
              id="api-key"
              type="password"
              className="field"
              value={apiKey}
              placeholder={current?.provider === provider && current.hasKey ? 'Leave blank to keep the current key' : 'Paste your key'}
              disabled={pending}
              onChange={(event) => setApiKey(event.target.value)}
            />
            {definition.keyUrl ? (
              <a
                href={definition.keyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-block text-xs text-brand-600 hover:underline"
              >
                Get a key from {definition.label} ↗
              </a>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="model">
              Model {definition.defaultModel ? `(default: ${definition.defaultModel})` : ''}
            </label>
            <input
              id="model"
              className="field"
              value={model}
              placeholder={definition.defaultModel || 'model id'}
              disabled={pending}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {saved ? <p className="mt-3 text-sm text-green-700">Saved.</p> : null}

        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary" disabled={pending} onClick={save}>
            {pending ? 'Saving…' : 'Save provider'}
          </button>
          {current ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await clearAiCredential()
                  router.refresh()
                })
              }
            >
              Remove my provider
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
