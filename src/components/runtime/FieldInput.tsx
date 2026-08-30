'use client'

import type { ModuleField } from '@/lib/modules/spec'
import type { FieldValue } from '@/lib/runtime/values'

/**
 * Renders one declared field as a real input. Every field type a manifest can
 * declare has a case here — which is exactly why a module never needs to ship
 * its own form code.
 */
export default function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ModuleField
  value: FieldValue
  onChange: (value: FieldValue) => void
  disabled?: boolean
}) {
  const id = `field-${field.key}`
  const text = value === null || value === undefined ? '' : String(value)

  const control = (() => {
    switch (field.type) {
      case 'longtext':
        return (
          <textarea
            id={id}
            className="field min-h-[88px] resize-y"
            value={text}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        )

      case 'boolean':
        return (
          <label className="flex cursor-pointer items-center gap-2.5 py-1">
            <input
              id={id}
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              checked={value === true}
              disabled={disabled}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span className="text-sm text-ink-700">{field.label}</span>
          </label>
        )

      case 'select':
        return (
          <select
            id={id}
            className="field"
            value={text}
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

      case 'number':
      case 'money':
        return (
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step={field.type === 'money' ? '0.01' : 'any'}
            className="field"
            value={text}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : Number(event.target.value))
            }
          />
        )

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="color"
              className="h-9 w-14 cursor-pointer rounded border border-ink-200 bg-white p-1"
              value={/^#[0-9a-fA-F]{6}$/.test(text) ? text : '#636ef1'}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            />
            <span className="font-mono text-xs text-ink-500">{text || '#636ef1'}</span>
          </div>
        )

      default: {
        const inputType =
          field.type === 'email'
            ? 'email'
            : field.type === 'phone'
              ? 'tel'
              : field.type === 'date'
                ? 'date'
                : field.type === 'time'
                  ? 'time'
                  : field.type === 'url' || field.type === 'image'
                    ? 'url'
                    : 'text'

        return (
          <input
            id={id}
            type={inputType}
            className="field"
            value={text}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      }
    }
  })()

  return (
    <div>
      {field.type === 'boolean' ? null : (
        <label className="label" htmlFor={id}>
          {field.label}
          {field.required ? <span className="ml-1 text-red-500">*</span> : null}
        </label>
      )}
      {control}
      {field.help ? <p className="mt-1 text-xs text-ink-500">{field.help}</p> : null}
    </div>
  )
}
