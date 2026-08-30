'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfile, setPagePublished } from '@/app/dashboard/actions'
import type { ProfileRow } from '@/lib/supabase/types'

export default function PageSettings({
  profile,
  baseUrl,
}: {
  profile: ProfileRow
  baseUrl: string
}) {
  const router = useRouter()
  const [handle, setHandle] = useState(profile.handle)
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio)
  const [accent, setAccent] = useState(profile.accent)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setSaved(false)

    const result = await saveProfile({
      handle,
      display_name: displayName,
      bio,
      accent,
    })

    setPending(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSaved(true)
    router.refresh()
  }

  async function togglePublished(next: boolean) {
    setPending(true)
    await setPagePublished(next)
    setPending(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">
              {profile.page_published ? 'Your page is live' : 'Your page is switched off'}
            </h2>
            <p className="mt-0.5 text-sm text-ink-500">
              {profile.page_published
                ? 'Anyone with the link can see the apps you chose to show.'
                : 'Nothing is visible to anyone until you switch this on.'}
            </p>
            {profile.page_published ? (
              <a
                href={`${baseUrl}/u/${profile.handle}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block font-mono text-xs text-brand-600 hover:underline"
              >
                {baseUrl}/u/{profile.handle} ↗
              </a>
            ) : null}
          </div>

          <button
            type="button"
            className={profile.page_published ? 'btn-secondary' : 'btn-primary'}
            disabled={pending}
            onClick={() => togglePublished(!profile.page_published)}
          >
            {profile.page_published ? 'Switch off' : 'Publish my page'}
          </button>
        </div>
      </section>

      <form onSubmit={save} className="card space-y-4 p-5">
        <h2 className="font-medium">Page details</h2>

        <div>
          <label className="label" htmlFor="handle">
            Handle
          </label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-ink-400">{baseUrl}/u/</span>
            <input
              id="handle"
              className="field"
              value={handle}
              maxLength={31}
              disabled={pending}
              onChange={(event) => setHandle(event.target.value.toLowerCase())}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            className="field"
            value={displayName}
            maxLength={80}
            placeholder="The Fox & Hound"
            disabled={pending}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="bio">
            Short description
          </label>
          <textarea
            id="bio"
            className="field min-h-[80px] resize-y"
            value={bio}
            maxLength={400}
            placeholder="Corner pub on Alder Street. Kitchen open till 10."
            disabled={pending}
            onChange={(event) => setBio(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="accent">
            Accent colour
          </label>
          <div className="flex items-center gap-2">
            <input
              id="accent"
              type="color"
              className="h-9 w-14 cursor-pointer rounded border border-ink-200 bg-white p-1"
              value={accent}
              disabled={pending}
              onChange={(event) => setAccent(event.target.value)}
            />
            <span className="font-mono text-xs text-ink-500">{accent}</span>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {saved ? <p className="text-sm text-green-700">Saved.</p> : null}

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save page details'}
        </button>
      </form>
    </div>
  )
}
