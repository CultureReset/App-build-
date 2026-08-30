'use client'

import { useState } from 'react'
import RecordForm from '@/components/runtime/RecordForm'
import { saveSettings } from '@/app/dashboard/actions'
import type { ModuleField } from '@/lib/modules/spec'
import type { RecordData } from '@/lib/runtime/values'

export default function SettingsForm({
  installId,
  fields,
  config,
}: {
  installId: string
  fields: ModuleField[]
  config: Record<string, unknown>
}) {
  const [saved, setSaved] = useState(false)

  const initial: RecordData = {}
  for (const field of fields) {
    const value = config[field.key]
    initial[field.key] =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : field.defaultValue !== undefined
          ? (field.defaultValue as RecordData[string])
          : null
  }

  return (
    <section className="card p-5">
      <h2 className="font-medium">Settings</h2>
      <p className="mb-4 mt-0.5 text-sm text-ink-500">
        These apply to this app only. Other apps on your account are unaffected.
      </p>

      <RecordForm
        fields={fields}
        initial={initial}
        submitLabel="Save settings"
        onSubmit={async (data) => {
          setSaved(false)
          const result = await saveSettings(installId, data)
          if (!result.error) setSaved(true)
          return result
        }}
      />

      {saved ? <p className="mt-3 text-sm text-green-700">Settings saved.</p> : null}
    </section>
  )
}
