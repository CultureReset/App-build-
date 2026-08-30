'use client'

import { useState } from 'react'
import RecordForm from '@/components/runtime/RecordForm'
import { formatValue, relativeTime } from '@/lib/runtime/format'
import { emptyRecord, readValue, type RecordData } from '@/lib/runtime/values'
import type { ModuleCollection } from '@/lib/modules/spec'
import type { RecordRow } from '@/lib/supabase/types'
import {
  createRecord,
  deleteRecord,
  moveRecord,
  updateRecord,
} from '@/app/dashboard/actions'

/**
 * The owner-facing screen for one collection: list, add, edit, reorder, delete.
 * Generated purely from the collection declaration, so a brand new module gets
 * a complete admin UI without a line of its own code.
 */
export default function CollectionManager({
  installId,
  collectionKey,
  collection,
  rows,
  currency,
}: {
  installId: string
  collectionKey: string
  collection: ModuleCollection
  rows: RecordRow[]
  currency: string
}) {
  const [mode, setMode] = useState<'idle' | 'create' | { editing: string }>('idle')
  const [busyId, setBusyId] = useState<string | null>(null)

  const titleField = collection.fields.find((field) => field.key === collection.titleField)
  const subtitleField = collection.fields.find((field) => field.key === collection.subtitleField)
  const groupField = collection.fields.find((field) => field.key === collection.groupField)

  const groups = groupField
    ? (groupField.options ?? []).map((option) => ({
        key: option.value,
        label: option.label,
        rows: rows.filter((row) => readValue(row.data, groupField.key) === option.value),
      }))
    : [{ key: 'all', label: '', rows }]

  const ungrouped = groupField
    ? rows.filter(
        (row) =>
          !(groupField.options ?? []).some(
            (option) => option.value === readValue(row.data, groupField.key),
          ),
      )
    : []

  if (ungrouped.length > 0) {
    groups.push({ key: '__other', label: 'Uncategorised', rows: ungrouped })
  }

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id)
    try {
      await action()
    } finally {
      setBusyId(null)
    }
  }

  function renderRow(row: RecordRow, index: number, siblings: RecordRow[]) {
    if (typeof mode === 'object' && mode.editing === row.id) {
      return (
        <li key={row.id} className="p-4">
          <RecordForm
            fields={collection.fields}
            initial={row.data as RecordData}
            submitLabel="Save changes"
            onCancel={() => setMode('idle')}
            onSubmit={async (data) => {
              const result = await updateRecord(installId, collectionKey, row.id, data)
              if (!result.error) setMode('idle')
              return result
            }}
          />
        </li>
      )
    }

    const title = titleField
      ? formatValue(titleField, readValue(row.data, titleField.key), currency)
      : ''
    const subtitle = subtitleField
      ? formatValue(subtitleField, readValue(row.data, subtitleField.key), currency)
      : ''

    return (
      <li key={row.id} className="flex items-start gap-3 p-4">
        {collection.sortable ? (
          <div className="flex flex-col gap-0.5 pt-0.5">
            <button
              type="button"
              aria-label="Move up"
              className="rounded px-1 text-xs text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
              disabled={index === 0 || busyId === row.id}
              onClick={() =>
                runAction(row.id, () => moveRecord(installId, collectionKey, row.id, 'up'))
              }
            >
              ▲
            </button>
            <button
              type="button"
              aria-label="Move down"
              className="rounded px-1 text-xs text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
              disabled={index === siblings.length - 1 || busyId === row.id}
              onClick={() =>
                runAction(row.id, () => moveRecord(installId, collectionKey, row.id, 'down'))
              }
            >
              ▼
            </button>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-ink-900">{title || 'Untitled'}</span>
            {subtitle ? <span className="text-sm text-ink-500">{subtitle}</span> : null}
            {row.submitted_by_public ? (
              <span className="chip bg-brand-50 text-brand-700">from a visitor</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-ink-400">{relativeTime(row.created_at)}</p>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => setMode({ editing: row.id })}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            disabled={busyId === row.id}
            onClick={() => runAction(row.id, () => deleteRecord(installId, row.id))}
          >
            Delete
          </button>
        </div>
      </li>
    )
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <div>
          <h2 className="font-medium">{collection.label}</h2>
          <p className="text-xs text-ink-500">
            {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        {mode === 'create' ? null : (
          <button type="button" className="btn-primary text-xs" onClick={() => setMode('create')}>
            Add {collection.labelSingular.toLowerCase()}
          </button>
        )}
      </header>

      {mode === 'create' ? (
        <div className="border-b border-ink-200 bg-ink-50/60 p-4">
          <RecordForm
            fields={collection.fields}
            initial={emptyRecord(collection)}
            submitLabel={`Add ${collection.labelSingular.toLowerCase()}`}
            onCancel={() => setMode('idle')}
            onSubmit={async (data) => {
              const result = await createRecord(installId, collectionKey, data)
              if (!result.error) setMode('idle')
              return result
            }}
          />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-500">
          Nothing here yet. Add your first {collection.labelSingular.toLowerCase()}.
        </p>
      ) : (
        groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <div key={group.key}>
              {group.label ? (
                <h3 className="border-b border-ink-100 bg-ink-50/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {group.label}
                </h3>
              ) : null}
              <ul className="divide-y divide-ink-100">
                {group.rows.map((row, index) => renderRow(row, index, group.rows))}
              </ul>
            </div>
          ))
      )}
    </section>
  )
}
