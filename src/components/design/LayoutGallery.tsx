'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { applyTemplate, deleteLayout, publishLayout } from '@/app/dashboard/design/actions'
import { coerceTheme, themeToCssVars, type Theme } from '@/lib/theme/spec'
import type { PageTemplateRow } from '@/lib/supabase/types'

type Entry = {
  id: string
  name: string
  description: string
  category: string
  theme: Theme
  plan: { module_id: string }[]
  builtin: boolean
  mine: boolean
  useCount: number
}

function Swatches({ theme }: { theme: Theme }) {
  const vars = themeToCssVars(theme)

  return (
    <div
      className="flex h-16 items-end gap-1 rounded-lg p-2"
      style={{ ...vars, background: theme.bgColor } as React.CSSProperties}
    >
      <span
        className="h-6 flex-1 rounded"
        style={{ background: theme.surfaceColor, border: '1px solid var(--pg-border)' }}
      />
      <span className="h-9 flex-1 rounded" style={{ background: theme.accent }} />
      <span
        className="h-4 flex-1 rounded"
        style={{ background: theme.surfaceColor, border: '1px solid var(--pg-border)' }}
      />
    </div>
  )
}

/**
 * Layouts are the second reusable artifact in the ecosystem, alongside apps.
 *
 * Applying one restyles the page and installs the blocks it names, in order.
 * It carries only the shape — never anyone's content — and it is additive:
 * nothing you already have is deleted.
 */
export default function LayoutGallery({
  templates,
  moduleIcons,
}: {
  /** Built-in and user-published layouts alike — they are the same kind of row. */
  templates: PageTemplateRow[]
  /** Resolved on the server, since the catalogue lives in the database. */
  moduleIcons: Record<string, { icon: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'general', isPublic: true })

  const entries: Entry[] = templates.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    theme: coerceTheme(row.theme),
    plan: row.plan,
    builtin: row.is_builtin,
    mine: row.mine === true,
    useCount: row.use_count,
  }))

  function apply(entry: Entry) {
    startTransition(async () => {
      setError(null)
      const result = await applyTemplate(entry.id)

      if (result.error) {
        setError(result.error)
        return
      }

      setConfirming(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-medium">Publish your layout</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Share the design you built. Anyone can start from it and fill it with their own content —
          your data never travels with it.
        </p>

        {publishing ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="layout-name">
                Name
              </label>
              <input
                id="layout-name"
                className="field"
                value={form.name}
                maxLength={60}
                placeholder="Boutique Agency Page"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="layout-description">
                What is it for?
              </label>
              <textarea
                id="layout-description"
                className="field min-h-[70px] resize-y"
                value={form.description}
                maxLength={300}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="layout-category">
                Category
              </label>
              <select
                id="layout-category"
                className="field"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {['general', 'hospitality', 'events', 'commerce', 'content', 'operations', 'personal'].map(
                  (category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ),
                )}
              </select>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={form.isPublic}
                onChange={(event) => setForm({ ...form, isPublic: event.target.checked })}
              />
              <span>List it publicly so anyone can use it</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={pending || form.name.trim().length === 0}
                onClick={() =>
                  startTransition(async () => {
                    setError(null)
                    const result = await publishLayout(form)

                    if (result.error) {
                      setError(result.error)
                      return
                    }

                    setPublishing(false)
                    setForm({ name: '', description: '', category: 'general', isPublic: true })
                    router.refresh()
                  })
                }
              >
                {pending ? 'Publishing…' : 'Publish layout'}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setPublishing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-secondary mt-4 text-sm" onClick={() => setPublishing(true)}>
            Publish my current design
          </button>
        )}
      </section>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <section>
        <h2 className="mb-1 font-medium">Layouts you can use</h2>
        <p className="mb-4 text-sm text-ink-500">
          Applying one restyles your page and installs the blocks it needs. Anything you already
          have is kept — nothing is deleted.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <article key={entry.id} className="card flex flex-col p-4">
              <Swatches theme={entry.theme} />

              <div className="mt-3 flex items-start justify-between gap-2">
                <h3 className="font-medium">{entry.name}</h3>
                {entry.builtin ? (
                  <span className="chip shrink-0 bg-ink-100 text-ink-600">Built in</span>
                ) : entry.mine ? (
                  <span className="chip shrink-0 bg-brand-50 text-brand-700">Yours</span>
                ) : null}
              </div>

              <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">{entry.description}</p>

              <div className="mt-3 flex flex-wrap gap-1">
                {entry.plan.slice(0, 6).map((block, index) => {
                  const known = moduleIcons[block.module_id]

                  return (
                    <span
                      key={`${block.module_id}-${index}`}
                      title={known?.name ?? block.module_id}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-sm"
                    >
                      {known?.icon ?? '📦'}
                    </span>
                  )
                })}
              </div>

              <div className="mt-4 border-t border-ink-100 pt-3">
                {confirming === entry.id ? (
                  <div className="space-y-2">
                    <p className="text-xs text-ink-600">
                      This will restyle your page and install any missing blocks. Your existing
                      content stays.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={pending}
                        onClick={() => apply(entry)}
                      >
                        {pending ? 'Applying…' : 'Apply layout'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => setConfirming(entry.id)}
                    >
                      Use this layout
                    </button>

                    <span className="flex items-center gap-2">
                      <span className="text-xs text-ink-400">{entry.useCount} uses</span>
                      {entry.mine ? (
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await deleteLayout(entry.id)
                              router.refresh()
                            })
                          }
                        >
                          Delete
                        </button>
                      ) : null}
                    </span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
