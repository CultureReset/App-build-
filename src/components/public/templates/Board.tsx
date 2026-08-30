import { relativeTime } from '@/lib/runtime/format'
import { EmptyBlock, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

/** A public feed of entries, newest first. */
export default function Board({ surface, collection, records, variant }: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="Nothing posted yet." />
  }

  return (
    <ul className={variant === 'cards' ? 'pg-stack' : 'pg-surface divide-y'}>
      {rows.map((row) => (
        <li
          key={row.id}
          className={variant === 'cards' ? 'pg-surface pg-pad' : 'pg-pad'}
          style={{ borderColor: 'var(--pg-border)' }}
        >
          <p className="font-medium">{text(row, collection.titleField)}</p>
          {collection.subtitleField && text(row, collection.subtitleField) ? (
            <p className="pg-muted mt-0.5 text-sm">{text(row, collection.subtitleField)}</p>
          ) : null}
          {surface.bodyField && text(row, surface.bodyField) ? (
            <p className="pg-muted mt-1.5 text-sm leading-relaxed">
              {text(row, surface.bodyField)}
            </p>
          ) : null}
          <p className="pg-muted mt-1.5 text-xs opacity-70">{relativeTime(row.created_at)}</p>
        </li>
      ))}
    </ul>
  )
}
