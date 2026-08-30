'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { installModule } from '@/app/dashboard/actions'
import { PERMISSION_COPY, type ModulePermission } from '@/lib/modules/spec'

/**
 * Install is deliberately a two-step action: the visitor sees, in plain
 * language, exactly what the app will be allowed to do before it is added.
 * That prompt is the trust contract of the whole store.
 */
export default function InstallButton({
  moduleId,
  moduleName,
  permissions,
  installedCount,
}: {
  moduleId: string
  moduleName: string
  permissions: ModulePermission[]
  installedCount: number
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setPending(true)
    setError(null)

    const result = await installModule(moduleId)

    setPending(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setConfirming(false)
    router.push('/dashboard')
    router.refresh()
  }

  if (!confirming) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary text-xs" onClick={() => setConfirming(true)}>
          {installedCount > 0 ? 'Install another' : 'Install'}
        </button>
        {installedCount > 0 ? (
          <span className="text-xs text-ink-500">
            {installedCount} installed
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg border border-ink-200 bg-ink-50 p-3">
      <p className="text-xs font-medium text-ink-700">{moduleName} will be able to:</p>
      <ul className="mt-2 space-y-1">
        {permissions.map((permission) => (
          <li key={permission} className="flex gap-2 text-xs text-ink-600">
            <span aria-hidden className="text-ink-400">
              •
            </span>
            <span>{PERMISSION_COPY[permission]}</span>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary text-xs" onClick={confirm} disabled={pending}>
          {pending ? 'Installing…' : 'Allow and install'}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
