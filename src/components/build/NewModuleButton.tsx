'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createModule } from '@/app/dashboard/build/actions'

export default function NewModuleButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Build an app
      </button>
    )
  }

  return (
    <div className="card w-full max-w-md p-4">
      <label className="label" htmlFor="new-module-name">
        What should it be called?
      </label>
      <input
        id="new-module-name"
        className="field"
        value={name}
        maxLength={48}
        autoFocus
        placeholder="Booking requests"
        onChange={(event) => setName(event.target.value)}
      />

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={pending || name.trim().length < 2}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const result = await createModule(name)

              if (result.error) {
                setError(result.error)
                return
              }

              if (result.id) {
                router.push(`/dashboard/build/${result.id}`)
              }
            })
          }
        >
          {pending ? 'Creating…' : 'Create'}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
