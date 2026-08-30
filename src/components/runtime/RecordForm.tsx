'use client'

import { useState } from 'react'
import FieldInput from '@/components/runtime/FieldInput'
import type { ModuleField } from '@/lib/modules/spec'
import type { FieldValue, RecordData } from '@/lib/runtime/values'

/**
 * A form built entirely from declared fields. Used for owner records, module
 * settings and public submissions alike — the only difference between them is
 * which fields get passed in.
 */
export default function RecordForm({
  fields,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  resetAfterSubmit = false,
}: {
  fields: ModuleField[]
  initial: RecordData
  submitLabel: string
  onSubmit: (data: RecordData) => Promise<{ error?: string } | void>
  onCancel?: () => void
  resetAfterSubmit?: boolean
}) {
  const [values, setValues] = useState<RecordData>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function update(key: string, value: FieldValue) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      const result = await onSubmit(values)

      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }

      if (resetAfterSubmit) {
        setValues(initial)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={values[field.key] ?? null}
          disabled={pending}
          onChange={(value) => update(field.key, value)}
        />
      ))}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
