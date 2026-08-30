import { EmptyBlock, safeHref, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

const ICONS: Record<string, string> = {
  arrow: '→',
  phone: '📞',
  message: '💬',
  mail: '✉️',
  calendar: '📅',
  map: '📍',
  card: '💳',
  download: '⬇️',
  star: '⭐',
}

/** The row of buttons that turns a visitor into a conversation. */
export default function Actions({ surface, collection, records, variant }: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="No actions yet." />
  }

  const layout =
    variant === 'grid'
      ? 'grid grid-cols-2 gap-[var(--pg-gap)]'
      : variant === 'inline'
        ? 'flex flex-wrap gap-[var(--pg-gap)]'
        : 'pg-stack'

  return (
    <div className={layout}>
      {rows.map((row) => {
        const href = safeHref(text(row, surface.linkField))

        if (!href) {
          return null
        }

        const icon = ICONS[text(row, 'icon')] ?? ''
        const secondary = text(row, 'style') === 'secondary'

        return (
          <a
            key={row.id}
            href={href}
            target="_blank"
            rel="noreferrer noopener nofollow ugc"
            className={`pg-btn ${secondary ? 'pg-btn-secondary' : 'pg-btn-primary'} ${
              variant === 'inline' ? '' : 'w-full'
            }`}
          >
            {icon ? <span aria-hidden>{icon}</span> : null}
            <span>{text(row, collection.titleField)}</span>
          </a>
        )
      })}
    </div>
  )
}
