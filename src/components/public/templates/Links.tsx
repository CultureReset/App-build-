import { EmptyBlock, safeHref, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

export default function Links({ collection, records, variant }: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="No links yet." />
  }

  const layout =
    variant === 'grid' ? 'grid grid-cols-2 gap-[var(--pg-gap)]' : 'pg-stack'

  return (
    <ul className={layout}>
      {rows.map((row) => {
        const href = safeHref(text(row, collection.subtitleField ?? 'url'))

        if (!href) {
          return null
        }

        const label = text(row, collection.titleField)
        const note = text(row, 'description')

        return (
          <li key={row.id}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener nofollow ugc"
              className={
                variant === 'buttons'
                  ? 'pg-btn pg-btn-primary w-full'
                  : 'pg-surface pg-pad block text-center transition-opacity hover:opacity-90'
              }
            >
              <span className="font-medium">{label}</span>
              {note && variant !== 'buttons' ? (
                <span className="pg-muted mt-0.5 block text-xs">{note}</span>
              ) : null}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
