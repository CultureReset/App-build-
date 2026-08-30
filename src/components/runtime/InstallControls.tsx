'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  renameInstall,
  setAcceptingSubmissions,
  setInstallPublic,
  uninstallModule,
} from '@/app/dashboard/actions'

function Toggle({
  checked,
  disabled,
  onChange,
  label,
  help,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
  help: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        <span className="block text-xs text-ink-500">{help}</span>
      </span>
    </label>
  )
}

export default function InstallControls({
  installId,
  name,
  hasPublicSurface,
  acceptsSubmissions,
  publicEnabled,
  acceptingSubmissions,
  publicUrl,
  pagePublished,
}: {
  installId: string
  name: string
  hasPublicSurface: boolean
  acceptsSubmissions: boolean
  publicEnabled: boolean
  acceptingSubmissions: boolean
  publicUrl: string | null
  pagePublished: boolean
}) {
  const router = useRouter()
  const [draftName, setDraftName] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [copied, setCopied] = useState(false)

  async function run(action: () => Promise<{ error?: string }>) {
    setPending(true)
    setError(null)

    const result = await action()

    setPending(false)

    if (result.error) {
      setError(result.error)
      return false
    }

    router.refresh()
    return true
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="font-medium">This app</h2>

        <div className="mt-4">
          <label className="label" htmlFor="install-name">
            Name
          </label>
          <div className="flex gap-2">
            <input
              id="install-name"
              className="field"
              value={draftName}
              maxLength={80}
              disabled={pending}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              disabled={pending || draftName.trim() === name}
              onClick={() => run(() => renameInstall(installId, draftName))}
            >
              Save
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Only you see this. It is how the app is labelled in your dashboard.
          </p>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-medium">Public page</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {hasPublicSurface
              ? 'Decide whether visitors can see this app.'
              : 'This app runs entirely behind the scenes and has nothing to publish.'}
          </p>
        </div>

        {hasPublicSurface ? (
          <>
            <Toggle
              label="Show this app on my public page"
              help={
                pagePublished
                  ? 'Visitors will see it as a section on your page.'
                  : 'Your public page is switched off, so nothing is visible yet.'
              }
              checked={publicEnabled}
              disabled={pending}
              onChange={(next) => run(() => setInstallPublic(installId, next))}
            />

            {acceptsSubmissions ? (
              <Toggle
                label="Accept new submissions"
                help="Turn this off to keep the page visible but stop taking entries."
                checked={acceptingSubmissions}
                disabled={pending || !publicEnabled}
                onChange={(next) => run(() => setAcceptingSubmissions(installId, next))}
              />
            ) : null}

            {publicEnabled && publicUrl ? (
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="mb-1.5 text-xs font-medium text-ink-600">Shareable link</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded border border-ink-200 bg-white px-2 py-1.5 text-xs">
                    {publicUrl}
                  </code>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 text-xs"
                    onClick={async () => {
                      await navigator.clipboard.writeText(publicUrl)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(publicUrl)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-secondary shrink-0 text-xs"
                  >
                    QR code
                  </a>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Remove</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Deletes this app and everything inside it. Your other apps are untouched.
        </p>

        {confirmRemove ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-danger text-sm"
              disabled={pending}
              onClick={async () => {
                const ok = await run(() => uninstallModule(installId))
                if (ok) router.push('/dashboard')
              }}
            >
              {pending ? 'Removing…' : 'Yes, remove it permanently'}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={pending}
              onClick={() => setConfirmRemove(false)}
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-danger mt-4 text-sm"
            onClick={() => setConfirmRemove(true)}
          >
            Remove this app
          </button>
        )}
      </section>
    </div>
  )
}
