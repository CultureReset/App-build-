'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import VoiceInput from '@/components/build/VoiceInput'
import { createModuleFromAiDraft, proposeApp } from '@/app/dashboard/build/ai-actions'
import { TEMPLATE_INFO } from '@/lib/modules/templates'
import type { AiDraft } from '@/lib/ai/draft-schema'
import type { ModuleDraft } from '@/lib/modules/derive'

type Turn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; draft: AiDraft; preview: ModuleDraft }
  | { role: 'error'; text: string }

/** A compact read of what would be created — not the full editor, just enough to judge it. */
function DraftPreview({ draft, preview }: { draft: AiDraft; preview: ModuleDraft }) {
  const collection = Object.values(preview.collections)[0]
  const surface = preview.publicSurface

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${preview.accent}1a` }}
        >
          {preview.icon}
        </div>
        <div className="min-w-0">
          <p className="font-medium">{preview.name}</p>
          <p className="text-sm text-ink-500">{preview.tagline}</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{preview.description}</p>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {collection.label}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {collection.fields.map((field) => (
            <span key={field.key} className="chip bg-ink-100 text-ink-600">
              {field.label}
              {field.required ? ' *' : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="chip bg-ink-100 text-ink-600">{preview.category}</span>
        {surface ? (
          <span className="chip bg-brand-50 text-brand-700">
            Public: {TEMPLATE_INFO[surface.template].label}
          </span>
        ) : (
          <span className="chip bg-ink-100 text-ink-600">Behind the scenes</span>
        )}
      </div>

      {draft.groupByFieldLabel ? (
        <p className="mt-2 text-xs text-ink-500">Grouped by {draft.groupByFieldLabel}.</p>
      ) : null}
    </div>
  )
}

export default function DescribeBuilder({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [turns, setTurns] = useState<Turn[]>([])
  const [prompt, setPrompt] = useState('')
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)

  const latestAssistant = [...turns].reverse().find((turn) => turn.role === 'assistant') as
    | Extract<Turn, { role: 'assistant' }>
    | undefined

  function submit() {
    const text = prompt.trim()

    if (!text || pending) {
      return
    }

    setPrompt('')
    setTurns((current) => [...current, { role: 'user', text }])

    startTransition(async () => {
      const result = await proposeApp({ prompt: text, previous: latestAssistant?.draft })

      setTurns((current) => [
        ...current,
        result.ok
          ? { role: 'assistant', draft: result.draft, preview: result.preview }
          : { role: 'error', text: result.error },
      ])
    })
  }

  if (!configured) {
    return (
      <div className="card p-6 text-center">
        <p className="text-3xl">🧩</p>
        <h2 className="mt-3 font-medium">App generation is not set up yet</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
          This deployment does not have an AI provider configured. You can still build an app by
          hand — it takes the same few minutes either way.
        </p>
        <Link href="/dashboard/build" className="btn-primary mt-4 inline-flex">
          Start from scratch instead
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {turns.length === 0 ? (
        <div className="card p-5">
          <p className="text-sm text-ink-600">
            Describe what you need, or tap the microphone and say it. For example:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink-500">
            <li>&ldquo;A form where people can request a table booking&rdquo;</li>
            <li>&ldquo;A gallery of my recent work, grouped by category&rdquo;</li>
            <li>&ldquo;A private list of suppliers with a phone number and a note&rdquo;</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          {turns.map((turn, index) =>
            turn.role === 'user' ? (
              <p key={index} className="ml-auto max-w-[85%] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm text-white">
                {turn.text}
              </p>
            ) : turn.role === 'error' ? (
              <p key={index} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {turn.text}
              </p>
            ) : (
              <DraftPreview key={index} draft={turn.draft} preview={turn.preview} />
            ),
          )}
        </div>
      )}

      {pending ? <p className="text-sm text-ink-500">Thinking…</p> : null}

      <div className="flex gap-2">
        <VoiceInput
          disabled={pending}
          onTranscript={(text) => setPrompt((current) => (current ? `${current} ${text}` : text))}
        />
        <input
          className="field flex-1"
          value={prompt}
          disabled={pending}
          placeholder={
            latestAssistant ? 'Ask for a change, or say what to add…' : 'Describe the app you need…'
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={pending || prompt.trim().length === 0}
          onClick={submit}
        >
          {latestAssistant ? 'Refine' : 'Build it'}
        </button>
      </div>

      {latestAssistant ? (
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Link href="/dashboard/build" className="btn-secondary">
            Discard
          </Link>
          <button
            type="button"
            className="btn-primary"
            disabled={creating}
            onClick={() => {
              setCreating(true)
              startTransition(async () => {
                const result = await createModuleFromAiDraft(latestAssistant.draft)
                setCreating(false)

                if (!result.ok) {
                  setTurns((current) => [
                    ...current,
                    { role: 'error', text: result.error ?? 'Could not create that app.' },
                  ])
                  return
                }

                router.push(`/dashboard/build/${result.id}`)
              })
            }}
          >
            {creating ? 'Creating…' : 'Create this app'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
