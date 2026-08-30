import { formatValue } from '@/lib/runtime/format'
import { readValue } from '@/lib/runtime/values'
import { EmptyBlock, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

/** Menus and priced lists, optionally grouped into sections. */
export default function Catalog({ install, collection, records, variant, currency }: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="Nothing here yet." />
  }

  const subtitleField = collection.fields.find((field) => field.key === collection.subtitleField)
  const descriptionField = collection.fields.find((field) => field.key === 'description')
  const groupField = collection.fields.find((field) => field.key === collection.groupField)

  const groups = groupField
    ? (groupField.options ?? [])
        .map((option) => ({
          key: option.value,
          label: option.label,
          rows: rows.filter((row) => readValue(row.data, groupField.key) === option.value),
        }))
        .filter((group) => group.rows.length > 0)
    : [{ key: 'all', label: '', rows }]

  const footerNote =
    typeof install.config.footer_note === 'string' ? install.config.footer_note : ''

  return (
    <div className="space-y-[var(--pg-block-gap)]">
      {groups.map((group) => (
        <div key={group.key}>
          {group.label ? (
            <h3
              className="mb-2.5 text-xs font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--pg-accent)' }}
            >
              {group.label}
            </h3>
          ) : null}

          <div
            className={
              variant === 'grid'
                ? 'grid gap-[var(--pg-gap)] sm:grid-cols-2'
                : variant === 'cards'
                  ? 'pg-stack'
                  : 'pg-surface divide-y'
            }
            style={variant === 'list' ? { borderColor: 'var(--pg-border)' } : undefined}
          >
            {group.rows.map((row) => (
              <div
                key={row.id}
                className={
                  variant === 'list'
                    ? 'pg-pad flex items-baseline justify-between gap-4'
                    : 'pg-surface pg-pad flex items-baseline justify-between gap-4'
                }
                style={variant === 'list' ? { borderColor: 'var(--pg-border)' } : undefined}
              >
                <div className="min-w-0">
                  <p className="font-medium">{text(row, collection.titleField)}</p>
                  {descriptionField && text(row, descriptionField.key) ? (
                    <p className="pg-muted mt-0.5 text-sm leading-relaxed">
                      {text(row, descriptionField.key)}
                    </p>
                  ) : null}
                </div>

                {subtitleField && subtitleField.key !== descriptionField?.key ? (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatValue(subtitleField, readValue(row.data, subtitleField.key), currency)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      {footerNote ? <p className="pg-muted text-xs leading-relaxed">{footerNote}</p> : null}
    </div>
  )
}
