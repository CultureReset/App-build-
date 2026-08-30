import { EmptyBlock, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

/**
 * Uses native <details> for the accordion, so it works with JavaScript
 * disabled and is keyboard accessible without any custom handling.
 */
export default function Faq({ surface, collection, records, variant }: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="No questions yet." />
  }

  if (variant === 'list') {
    return (
      <div className="pg-stack">
        {rows.map((row) => (
          <div key={row.id} className="pg-surface pg-pad">
            <h3 className="font-semibold">{text(row, collection.titleField)}</h3>
            <p className="pg-muted mt-1.5 whitespace-pre-line text-sm leading-relaxed">
              {text(row, surface.bodyField)}
            </p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="pg-stack">
      {rows.map((row) => (
        <details key={row.id} className="pg-surface pg-pad group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
            <span>{text(row, collection.titleField)}</span>
            <span aria-hidden className="pg-muted shrink-0 transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="pg-muted mt-2.5 whitespace-pre-line text-sm leading-relaxed">
            {text(row, surface.bodyField)}
          </p>
        </details>
      ))}
    </div>
  )
}
