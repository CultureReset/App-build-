'use client'

import { useState } from 'react'
import { submitPublicRecord } from '@/app/u/actions'
import { emptyRecord, type FieldValue, type RecordData } from '@/lib/runtime/values'
import type { ModuleCollection, ModuleField } from '@/lib/modules/spec'

/**
 * The visitor-facing form, styled entirely from the page theme.
 *
 * Owner-only fields are filtered out before render, so they never reach the
 * browser at all — and the server strips them again on the way back in.
 */
function Control({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ModuleField
  value: FieldValue
  disabled: boolean
  onChange: (value: FieldValue) => void
}) {
  const id = `pg-${field.key}`
  const shown = value === null || value === undefined ? '' : String(value)

  if (field.type === 'longtext') {
    return (
      <textarea
        id={id}
        className="pg-field min-h-[96px] resize-y"
        value={shown}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        required={field.required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select
        id={id}
        className="pg-field"
        value={shown}
        required={field.required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose…</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2.5 text-sm">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    )
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'phone'
        ? 'tel'
        : field.type === 'number' || field.type === 'money'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : field.type === 'time'
              ? 'time'
              : field.type === 'url'
                ? 'url'
                : 'text'

  return (
    <input
      id={id}
      type={inputType}
      className="pg-field"
      value={shown}
      maxLength={field.maxLength}
      placeholder={field.placeholder}
      required={field.required}
      disabled={disabled}
      onChange={(event) =>
        onChange(
          (field.type === 'number' || field.type === 'money') && event.target.value !== ''
            ? Number(event.target.value)
            : event.target.value,
        )
      }
    />
  )
}

export default function ThemedForm({
  installId,
  collection,
  cta,
  intro,
  framed,
}: {
  installId: string
  collection: ModuleCollection
  cta: string
  intro?: string
  framed: boolean
}) {
  const fields = collection.fields.filter((field) => !field.ownerOnly)
  const blank = emptyRecord({ ...collection, fields })

  const [values, setValues] = useState<RecordData>(blank)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const result = await submitPublicRecord(installId, values)

      if (result.error) {
        setError(result.error)
        return
      }

      setValues(blank)
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const wrapper = framed ? 'pg-surface pg-pad' : ''

  if (sent) {
    return (
      <div className={`${wrapper} text-center`}>
        <p className="text-2xl" aria-hidden>
          ✅
        </p>
        <p className="mt-2 font-medium">Sent.</p>
        <p className="pg-muted mt-1 text-sm">Thanks — it came through.</p>
        <button
          type="button"
          className="pg-accent mt-4 text-sm font-medium underline-offset-4 hover:underline"
          onClick={() => setSent(false)}
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={wrapper}>
      {intro ? <p className="pg-muted mb-4 text-sm leading-relaxed">{intro}</p> : null}

      <div className="pg-stack">
        {fields.map((field) => (
          <div key={field.key}>
            {field.type === 'boolean' ? null : (
              <label className="pg-label" htmlFor={`pg-${field.key}`}>
                {field.label}
                {field.required ? <span aria-hidden> *</span> : null}
              </label>
            )}
            <Control
              field={field}
              value={values[field.key] ?? null}
              disabled={pending}
              onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
            />
            {field.help ? <p className="pg-muted mt-1 text-xs">{field.help}</p> : null}
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-sm" role="alert" style={{ color: '#c0392b' }}>
          {error}
        </p>
      ) : null}

      <button type="submit" className="pg-btn pg-btn-primary mt-4 w-full" disabled={pending}>
        {pending ? 'Sending…' : cta}
      </button>
    </form>
  )
}
