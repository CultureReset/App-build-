'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfile, setPagePublished } from '@/app/dashboard/actions'
import type { ProfileRow } from '@/lib/supabase/types'

export default function ProfileForm({
  profile,
  baseUrl,
}: {
  profile: ProfileRow
  baseUrl: string
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    handle: profile.handle,
    display_name: profile.display_name,
    tagline: profile.tagline,
    bio: profile.bio,
    accent: profile.accent,
    avatar_url: profile.avatar_url ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()

    startTransition(async () => {
      setError(null)
      const result = await saveProfile(form)

      if (result.error) {
        setError(result.error)
        return
      }

      setSaved(true)
      router.refresh()
    })
  }

  const pageUrl = `${baseUrl}/u/${profile.handle}`

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-medium">
              {profile.page_published ? 'Your page is live' : 'Your page is switched off'}
            </h2>
            <p className="mt-0.5 text-sm text-ink-500">
              {profile.page_published
                ? 'Anyone with the link can see the blocks you switched on.'
                : 'Nothing is visible to anyone until you switch this on.'}
            </p>
            {profile.page_published ? (
              <a
                href={pageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block break-all font-mono text-xs text-brand-600 hover:underline"
              >
                {pageUrl} ↗
              </a>
            ) : null}
          </div>

          <div className="flex shrink-0 gap-2">
            {profile.page_published ? (
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(pageUrl)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary"
              >
                QR code
              </a>
            ) : null}
            <button
              type="button"
              className={profile.page_published ? 'btn-secondary' : 'btn-primary'}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setPagePublished(!profile.page_published)
                  router.refresh()
                })
              }
            >
              {profile.page_published ? 'Switch off' : 'Publish my page'}
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <h2 className="font-medium">Who you are</h2>

        <div>
          <label className="label" htmlFor="handle">
            Handle
          </label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-ink-400">/u/</span>
            <input
              id="handle"
              className="field"
              value={form.handle}
              maxLength={31}
              disabled={pending}
              onChange={(event) => update('handle', event.target.value.toLowerCase())}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="display-name">
              Display name
            </label>
            <input
              id="display-name"
              className="field"
              value={form.display_name}
              maxLength={80}
              placeholder="Dana Whitfield"
              disabled={pending}
              onChange={(event) => update('display_name', event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="tagline">
              Tagline
            </label>
            <input
              id="tagline"
              className="field"
              value={form.tagline}
              maxLength={120}
              placeholder="Realtor · Northside & Ridgeway"
              disabled={pending}
              onChange={(event) => update('tagline', event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="avatar">
            Photo URL
          </label>
          <input
            id="avatar"
            className="field"
            value={form.avatar_url}
            placeholder="https://…"
            disabled={pending}
            onChange={(event) => update('avatar_url', event.target.value)}
          />
          <p className="mt-1 text-xs text-ink-500">
            Leave blank to use a coloured tile with your initial.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="bio">
            Short description
          </label>
          <textarea
            id="bio"
            className="field min-h-[80px] resize-y"
            value={form.bio}
            maxLength={400}
            placeholder="Fifteen years selling on the north side. Here to answer questions, not to chase you."
            disabled={pending}
            onChange={(event) => update('bio', event.target.value)}
          />
        </div>

        <div>
          <span className="label">Accent colour</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-14 cursor-pointer rounded border border-ink-200 bg-white p-1"
              value={form.accent}
              disabled={pending}
              aria-label="Accent colour"
              onChange={(event) => update('accent', event.target.value)}
            />
            <span className="font-mono text-xs text-ink-500">{form.accent}</span>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Used where a theme has not set its own accent.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {saved ? <p className="text-sm text-green-700">Saved.</p> : null}

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </div>
  )
}
