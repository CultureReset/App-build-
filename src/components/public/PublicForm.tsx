'use client'

import { useState } from 'react'
import RecordForm from '@/components/runtime/RecordForm'
import { submitPublicRecord } from '@/app/u/actions'
import { emptyRecord } from '@/lib/runtime/values'
import type { ModuleCollection } from '@/lib/modules/spec'

export default function PublicForm({
  installId,
  collection,
  cta,
  accent,
}: {
  installId: string
  collection: ModuleCollection
  cta: string
  accent: string
}) {
  const [sent, setSent] = useState(false)

  // Owner-only fields never reach the visitor's browser at all.
  const visitorFields = collection.fields.filter((field) => !field.ownerOnly)

  if (sent) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white p-6 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-medium">Sent.</p>
        <p className="mt-1 text-sm text-ink-500">Thanks — it landed.</p>
        <button
          type="button"
          className="mt-4 text-sm font-medium hover:underline"
          style={{ color: accent }}
          onClick={() => setSent(false)}
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <RecordForm
        fields={visitorFields}
        initial={emptyRecord({ ...collection, fields: visitorFields })}
        submitLabel={cta}
        resetAfterSubmit
        onSubmit={async (data) => {
          const result = await submitPublicRecord(installId, data)
          if (!result.error) setSent(true)
          return result
        }}
      />
    </div>
  )
}
