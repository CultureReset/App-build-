import PublicForm from '@/components/public/PublicForm'
import { formatValue } from '@/lib/runtime/format'
import { readValue } from '@/lib/runtime/values'
import type { ModuleManifest } from '@/lib/modules/spec'
import type { InstallRow, RecordRow } from '@/lib/supabase/types'

/**
 * Renders one install's public face.
 *
 * The runtime owns every template. A module chooses one by name and supplies
 * data — it can never inject markup, styles or scripts of its own, which is
 * what makes a store of third-party apps safe to put on a shared page.
 */
export default function PublicSurface({
  install,
  manifest,
  records,
  accent,
}: {
  install: InstallRow
  manifest: ModuleManifest
  records: RecordRow[]
  accent: string
}) {
  const surface = manifest.publicSurface

  if (!surface) {
    return null
  }

  const collection = manifest.collections[surface.collection]
  const currency = typeof install.config.currency === 'string' ? install.config.currency : '$'
  const footerNote =
    typeof install.config.footer_note === 'string' ? install.config.footer_note : ''
  const intro = typeof install.config.intro === 'string' ? install.config.intro : ''

  if (!collection) {
    return null
  }

  const titleField = collection.fields.find((field) => field.key === collection.titleField)
  const subtitleField = collection.fields.find((field) => field.key === collection.subtitleField)
  const groupField = collection.fields.find((field) => field.key === collection.groupField)
  const descriptionField = collection.fields.find((field) => field.key === 'description')

  // A row that declares an `available` or `visible` flag is hidden when it is off.
  const visible = records.filter((row) => {
    for (const key of ['available', 'visible']) {
      const field = collection.fields.find((candidate) => candidate.key === key)
      if (field?.type === 'boolean' && readValue(row.data, key) === false) {
        return false
      }
    }
    return true
  })

  if (surface.template === 'links') {
    return (
      <ul className="space-y-2.5">
        {visible.map((row) => {
          const label = titleField ? String(readValue(row.data, titleField.key) ?? '') : ''
          const href = subtitleField ? String(readValue(row.data, subtitleField.key) ?? '') : ''
          const note = descriptionField
            ? String(readValue(row.data, descriptionField.key) ?? '')
            : ''

          if (!href) {
            return null
          }

          return (
            <li key={row.id}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener nofollow ugc"
                className="block rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-center transition-colors hover:border-ink-300"
              >
                <span className="font-medium">{label}</span>
                {note ? <span className="mt-0.5 block text-xs text-ink-500">{note}</span> : null}
              </a>
            </li>
          )
        })}
        {visible.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-400">
            No links yet.
          </li>
        ) : null}
      </ul>
    )
  }

  if (surface.template === 'form') {
    const submitCollection = surface.submitCollection
      ? manifest.collections[surface.submitCollection]
      : undefined
    const accepting = install.accepting_submissions && submitCollection

    return (
      <div className="space-y-3">
        {intro ? <p className="text-sm leading-relaxed text-ink-600">{intro}</p> : null}

        {accepting ? (
          <PublicForm
            installId={install.id}
            collection={submitCollection}
            cta={submitCollection.publicWriteCta ?? 'Send'}
            accent={accent}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
            Closed for now — check back soon.
          </p>
        )}
      </div>
    )
  }

  // `catalog` and `board` both render as grouped lists of entries.
  const groups = groupField
    ? (groupField.options ?? [])
        .map((option) => ({
          key: option.value,
          label: option.label,
          rows: visible.filter((row) => readValue(row.data, groupField.key) === option.value),
        }))
        .filter((group) => group.rows.length > 0)
    : [{ key: 'all', label: '', rows: visible }]

  return (
    <div className="space-y-6">
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-400">
          Nothing here yet.
        </p>
      ) : null}

      {groups.map((group) => (
        <div key={group.key}>
          {group.label ? (
            <h3
              className="mb-2.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: accent }}
            >
              {group.label}
            </h3>
          ) : null}

          <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
            {group.rows.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {titleField ? String(readValue(row.data, titleField.key) ?? '') : ''}
                  </p>
                  {descriptionField && readValue(row.data, descriptionField.key) ? (
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
                      {String(readValue(row.data, descriptionField.key))}
                    </p>
                  ) : null}
                </div>
                {subtitleField && subtitleField.key !== descriptionField?.key ? (
                  <span className="shrink-0 text-sm font-medium tabular-nums text-ink-700">
                    {formatValue(subtitleField, readValue(row.data, subtitleField.key), currency)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {footerNote ? <p className="text-xs leading-relaxed text-ink-500">{footerNote}</p> : null}
    </div>
  )
}
