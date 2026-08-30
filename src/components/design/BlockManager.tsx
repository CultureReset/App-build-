'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { moveBlock, setBlockHeading, setBlockVariant } from '@/app/dashboard/design/actions'
import { setInstallPublic } from '@/app/dashboard/actions'
import { TEMPLATE_VARIANTS, VARIANT_LABELS, resolveVariant } from '@/lib/modules/spec'
import type { ModuleManifest } from '@/lib/modules/spec'
import type { InstallRow } from '@/lib/supabase/types'

export type Block = { install: InstallRow; manifest: ModuleManifest }

/**
 * The order and presentation of every block on the public page.
 *
 * Each block is one installed app. Changing how one displays is a per-install
 * setting — the module itself is untouched, so the same app can look completely
 * different on two different pages.
 */
export default function BlockManager({ blocks }: { blocks: Block[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [draftHeading, setDraftHeading] = useState('')

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      await action()
      router.refresh()
    })
  }

  const shown = blocks.filter((block) => block.install.public_enabled)
  const hidden = blocks.filter((block) => !block.install.public_enabled)

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <header className="border-b border-ink-200 px-4 py-3">
          <h2 className="font-medium">On your page</h2>
          <p className="text-xs text-ink-500">
            Top to bottom, exactly as visitors see it.
          </p>
        </header>

        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-500">
            Nothing is on your page yet. Switch a block on below, or apply a layout.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {shown.map((block, index) => {
              const surface = block.manifest.publicSurface!
              const variants = TEMPLATE_VARIANTS[surface.template]
              const current = resolveVariant(surface, block.install.display_variant)
              const heading = block.install.public_heading ?? block.install.name

              return (
                <li key={block.install.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <button
                        type="button"
                        aria-label="Move up"
                        className="rounded px-1 text-xs text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                        disabled={index === 0 || pending}
                        onClick={() => run(() => moveBlock(block.install.id, 'up'))}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        className="rounded px-1 text-xs text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                        disabled={index === shown.length - 1 || pending}
                        onClick={() => run(() => moveBlock(block.install.id, 'down'))}
                      >
                        ▼
                      </button>
                    </div>

                    <span className="text-lg leading-none">{block.manifest.icon}</span>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{block.install.name}</p>
                      <p className="text-xs text-ink-500">
                        {heading ? `Heading: “${heading}”` : 'No heading shown'}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Link
                        href={`/dashboard/apps/${block.install.id}`}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        Content
                      </Link>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        disabled={pending}
                        onClick={() => run(() => setInstallPublic(block.install.id, false))}
                      >
                        Hide
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-9">
                    {variants.map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setBlockVariant(block.install.id, variant))}
                        className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                          variant === current
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                        }`}
                      >
                        {VARIANT_LABELS[variant]}
                      </button>
                    ))}

                    {editing === block.install.id ? (
                      <span className="flex w-full items-center gap-2 pt-2">
                        <input
                          className="field text-xs"
                          value={draftHeading}
                          maxLength={80}
                          placeholder="Leave blank to hide the heading"
                          onChange={(event) => setDraftHeading(event.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-secondary shrink-0 text-xs"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const result = await setBlockHeading(block.install.id, draftHeading)
                              setEditing(null)
                              return result
                            })
                          }
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => {
                          setDraftHeading(heading)
                          setEditing(block.install.id)
                        }}
                      >
                        Edit heading
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <header className="border-b border-ink-200 px-4 py-3">
          <h2 className="font-medium">Installed but hidden</h2>
          <p className="text-xs text-ink-500">
            These still work in your dashboard — they just are not on your public page.
          </p>
        </header>

        {hidden.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">
            Every block you have installed is showing.{' '}
            <Link href="/dashboard/store" className="text-brand-600 hover:underline">
              Add more
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {hidden.map((block) => (
              <li key={block.install.id} className="flex items-center gap-3 p-4">
                <span className="text-lg leading-none">{block.manifest.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{block.install.name}</p>
                  <p className="truncate text-xs text-ink-500">{block.manifest.tagline}</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary shrink-0 text-xs"
                  disabled={pending}
                  onClick={() => run(() => setInstallPublic(block.install.id, true))}
                >
                  Show on page
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
