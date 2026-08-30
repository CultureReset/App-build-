import { formatValue } from '@/lib/runtime/format'
import { BlockImage, EmptyBlock, safeHref, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

/** "1 bedroom", "3 bedrooms" — labels are declared in the plural. */
function singularise(label: string, count: number): string {
  return count === 1 && label.endsWith('s') ? label.slice(0, -1) : label
}

/**
 * Property- and inventory-style listings: photo, price, status badge and a
 * meta line, with an optional link through to full details.
 */
export default function Listings({
  surface,
  collection,
  records,
  variant,
  currency,
}: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="No listings yet." />
  }

  const badgeField = collection.fields.find((field) => field.key === surface.badgeField)
  const priceField = collection.fields.find((field) => field.key === surface.priceField)

  const layout =
    variant === 'grid'
      ? 'grid items-stretch gap-[var(--pg-gap)] sm:grid-cols-2'
      : variant === 'cards'
        ? 'grid gap-[var(--pg-gap)]'
        : 'pg-stack'

  return (
    <div className={layout}>
      {rows.map((row) => {
        const image = safeHref(text(row, surface.imageField))
        const href = safeHref(text(row, surface.linkField))
        const title = text(row, collection.titleField)
        const address = text(row, 'address')
        const badge = badgeField
          ? formatValue(badgeField, text(row, badgeField.key) || null, currency)
          : ''
        const price = priceField
          ? formatValue(priceField, row.data[priceField.key] as number, currency)
          : ''

        const meta = (surface.metaFields ?? [])
          .map((key) => {
            const field = collection.fields.find((candidate) => candidate.key === key)
            const value = text(row, key)

            if (!field || !value) {
              return null
            }

            // Free-text meta (a size, say) is shown as written; counted meta
            // gets its label, singularised when there is exactly one.
            if (field.type !== 'number') {
              return value
            }

            return `${value} ${singularise(field.label.toLowerCase(), Number(value))}`
          })
          .filter(Boolean)

        const compact = variant === 'list'

        const body = (
          <article
            className={`pg-surface h-full overflow-hidden ${
              compact ? 'flex items-stretch gap-3' : 'flex flex-col'
            }`}
          >
            {image ? (
              <div
                className={
                  compact
                    ? 'w-28 shrink-0 overflow-hidden'
                    : 'pg-media aspect-[4/3] w-full overflow-hidden rounded-none'
                }
              >
                <BlockImage src={image} alt={title} className="h-full w-full object-cover" />
              </div>
            ) : null}

            <div className="pg-pad min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 font-semibold leading-tight">{title}</h3>
                {badge ? (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--pg-accent-soft)', color: 'var(--pg-accent)' }}
                  >
                    {badge}
                  </span>
                ) : null}
              </div>

              {address ? <p className="pg-muted mt-0.5 text-sm">{address}</p> : null}

              {price ? (
                <p className="pg-accent mt-2 text-lg font-semibold tabular-nums">{price}</p>
              ) : null}

              {meta.length > 0 ? (
                <p className="pg-muted mt-1.5 text-xs">{meta.join(' · ')}</p>
              ) : null}

              {!compact && surface.bodyField && text(row, surface.bodyField) ? (
                <p className="pg-muted mt-2 line-clamp-3 text-sm leading-relaxed">
                  {text(row, surface.bodyField)}
                </p>
              ) : null}
            </div>
          </article>
        )

        return href ? (
          <a
            key={row.id}
            href={href}
            target="_blank"
            rel="noreferrer noopener nofollow ugc"
            className="block h-full transition-opacity hover:opacity-90"
          >
            {body}
          </a>
        ) : (
          <div key={row.id} className="h-full">
            {body}
          </div>
        )
      })}
    </div>
  )
}
