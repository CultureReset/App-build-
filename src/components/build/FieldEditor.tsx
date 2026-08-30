'use client'

import { useState } from 'react'
import type { ModuleField } from '@/lib/modules/spec'

const TYPES: { value: ModuleField['type']; label: string; hint: string }[] = [
  { value: 'text', label: 'Short text', hint: 'A name, a title, an address' },
  { value: 'longtext', label: 'Long text', hint: 'A description or a message' },
  { value: 'number', label: 'Number', hint: 'A count or a quantity' },
  { value: 'money', label: 'Price', hint: 'Shown with a currency symbol' },
  { value: 'boolean', label: 'Yes / no', hint: 'A checkbox' },
  { value: 'select', label: 'Choice', hint: 'Pick one from a list you define' },
  { value: 'date', label: 'Date', hint: 'A calendar date' },
  { value: 'time', label: 'Time', hint: 'A time of day' },
  { value: 'email', label: 'Email', hint: 'Validated as an email address' },
  { value: 'phone', label: 'Phone', hint: 'Validated as a phone number' },
  { value: 'url', label: 'Link', hint: 'An http or https address' },
  { value: 'image', label: 'Image link', hint: 'A link to a hosted picture' },
  { value: 'color', label: 'Colour', hint: 'A colour picker' },
]

export function keyFrom(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^([0-9])/, 'f$1')
      .slice(0, 40) || 'field'

  let key = base
  let counter = 2

  while (taken.includes(key)) {
    key = `${base}_${counter}`
    counter += 1
  }

  return key
}

export function blankField(label: string, taken: string[]): ModuleField {
  return {
    key: keyFrom(label, taken),
    label,
    type: 'text',
    required: false,
    ownerOnly: false,
    maxLength: 120,
  }
}

/** Edits one declared field. What is set here becomes real inputs and real validation. */
export default function FieldEditor({
  field,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  field: ModuleField
  index: number
  count: number
  onChange: (next: ModuleField) => void
  onRemove: () => void
  onMove: (direction: 'up' | 'down') => void
}) {
  const [open, setOpen] = useState(false)
  const type = TYPES.find((entry) => entry.value === field.type)

  function set<K extends keyof ModuleField>(key: K, value: ModuleField[K]) {
    onChange({ ...field, [key]: value })
  }

  return (
    <li className="rounded-lg border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            aria-label="Move up"
            className="rounded px-1 text-[0.6rem] text-ink-400 hover:bg-ink-100 disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMove('up')}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move down"
            className="rounded px-1 text-[0.6rem] text-ink-400 hover:bg-ink-100 disabled:opacity-30"
            disabled={index === count - 1}
            onClick={() => onMove('down')}
          >
            ▼
          </button>
        </div>

        <input
          className="field min-w-[8rem] flex-1"
          value={field.label}
          maxLength={80}
          aria-label="Field label"
          onChange={(event) => set('label', event.target.value)}
        />

        <select
          className="field w-36 shrink-0"
          value={field.type}
          aria-label="Field type"
          onChange={(event) => set('type', event.target.value as ModuleField['type'])}
        >
          {TYPES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn-ghost shrink-0 px-2 py-1 text-xs"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Done' : 'Options'}
        </button>

        <button
          type="button"
          className="btn-ghost shrink-0 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
          onClick={onRemove}
          disabled={count === 1}
        >
          Remove
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-ink-100 bg-ink-50/60 p-3">
          <p className="text-xs text-ink-500">
            {type?.hint} · stored as <code className="font-mono">{field.key}</code>
          </p>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={field.required}
                onChange={(event) => set('required', event.target.checked)}
              />
              <span>Required</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={field.ownerOnly}
                onChange={(event) => set('ownerOnly', event.target.checked)}
              />
              <span>Only I can set this</span>
            </label>
          </div>

          {field.ownerOnly ? (
            <p className="text-xs text-ink-500">
              Hidden from public forms entirely, and reset to its default if anyone tries to send
              it. Use this for statuses and flags you control.
            </p>
          ) : null}

          <div>
            <label className="label" htmlFor={`help-${field.key}`}>
              Helper text
            </label>
            <input
              id={`help-${field.key}`}
              className="field"
              value={field.help ?? ''}
              maxLength={200}
              placeholder="Shown under the input"
              onChange={(event) => set('help', event.target.value || undefined)}
            />
          </div>

          {field.type === 'select' ? (
            <div>
              <span className="label">Choices</span>
              <div className="space-y-2">
                {(field.options ?? []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex gap-2">
                    <input
                      className="field"
                      value={option.label}
                      placeholder="Label"
                      aria-label="Choice label"
                      onChange={(event) => {
                        const options = [...(field.options ?? [])]
                        options[optionIndex] = {
                          label: event.target.value,
                          value: keyFrom(
                            event.target.value,
                            options.filter((_, i) => i !== optionIndex).map((o) => o.value),
                          ),
                        }
                        set('options', options)
                      }}
                    />
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      onClick={() =>
                        set(
                          'options',
                          (field.options ?? []).filter((_, i) => i !== optionIndex),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn-secondary mt-2 text-xs"
                onClick={() => {
                  const options = [...(field.options ?? [])]
                  const label = `Choice ${options.length + 1}`
                  options.push({
                    label,
                    value: keyFrom(
                      label,
                      options.map((option) => option.value),
                    ),
                  })
                  set('options', options)
                }}
              >
                Add a choice
              </button>
            </div>
          ) : null}

          {field.type === 'text' || field.type === 'longtext' ? (
            <div>
              <label className="label" htmlFor={`max-${field.key}`}>
                Maximum length
              </label>
              <input
                id={`max-${field.key}`}
                type="number"
                className="field w-32"
                value={field.maxLength ?? ''}
                min={1}
                max={field.type === 'longtext' ? 4000 : 400}
                onChange={(event) =>
                  set('maxLength', event.target.value ? Number(event.target.value) : undefined)
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
