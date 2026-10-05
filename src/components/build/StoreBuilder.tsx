'use client'

import { useState } from 'react'
import Link from 'next/link'
import ModuleBuilder from '@/components/build/ModuleBuilder'
import { blankDraft } from '@/lib/engine/drafts'
import type { ModuleDraft } from '@/lib/modules/derive'

export type Starter = { id: string; name: string; draft: ModuleDraft }

/**
 * The app builder without App-build-'s own login or store: pick a start
 * (blank, or one of the shipped apps — apps/<name>/manifest.json, read on the
 * server by lib/engine/starters.ts and passed in), edit it in the same
 * ModuleBuilder, and take the engine manifest to the Paperclip store.
 */
export default function StoreBuilder({ initial, describeAvailable, starters = [] }: { initial?: ModuleDraft; describeAvailable: boolean; starters?: Starter[] }) {
  const [draft, setDraft] = useState<ModuleDraft | null>(initial ?? null)
  const [name, setName] = useState('')

  if (draft) {
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm text-ink-500 hover:text-ink-900" onClick={() => setDraft(null)}>
          ← Start over
        </button>
        <ModuleBuilder key={draft.name + draft.version} initial={draft} storeMode />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Start from scratch</h2>
        <div className="flex gap-2">
          <input className="field flex-1" value={name} maxLength={48} placeholder="What should it be called?" onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn-primary" disabled={name.trim().length < 2} onClick={() => setDraft(blankDraft(name.trim()))}>
            Build
          </button>
        </div>
        {describeAvailable ? (
          <Link href="/build/describe" className="text-sm text-brand-700 hover:underline">
            Or describe it, or say it →
          </Link>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-600">Or start from an app that ships</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {starters.map((s) => (
            <button key={s.id} type="button" className="card p-4 text-left transition-shadow hover:shadow-md" onClick={() => setDraft(s.draft)}>
              <span className="text-xl">{s.draft.icon}</span>
              <span className="mt-2 block font-medium">{s.name}</span>
              <span className="mt-1 block text-xs text-ink-500">{s.draft.tagline}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
