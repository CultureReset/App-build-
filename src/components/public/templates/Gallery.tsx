import { BlockImage, EmptyBlock, safeHref, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

export default function Gallery({ surface, collection, records, variant }: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="No photos yet." />
  }

  if (variant === 'strip') {
    return (
      <ul className="-mx-1 flex snap-x gap-[var(--pg-gap)] overflow-x-auto px-1 pb-2">
        {rows.map((row) => {
          const image = safeHref(text(row, surface.imageField))
          if (!image) return null

          return (
            <li key={row.id} className="w-44 shrink-0 snap-start">
              <div className="pg-media aspect-square w-full">
                <BlockImage
                  src={image}
                  alt={text(row, collection.titleField)}
                  className="h-full w-full object-cover"
                />
              </div>
              {text(row, collection.titleField) ? (
                <p className="pg-muted mt-1.5 text-xs">{text(row, collection.titleField)}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  const layout =
    variant === 'feature'
      ? 'pg-stack'
      : 'grid grid-cols-2 gap-[var(--pg-gap)] sm:grid-cols-3'

  return (
    <ul className={layout}>
      {rows.map((row) => {
        const image = safeHref(text(row, surface.imageField))
        const href = safeHref(text(row, surface.linkField))
        const caption = text(row, collection.titleField)

        if (!image) {
          return null
        }

        const figure = (
          <figure>
            <div className={`pg-media w-full ${variant === 'feature' ? 'aspect-[3/2]' : 'aspect-square'}`}>
              <BlockImage src={image} alt={caption} className="h-full w-full object-cover" />
            </div>
            {caption ? (
              <figcaption className="pg-muted mt-1.5 text-xs">{caption}</figcaption>
            ) : null}
          </figure>
        )

        return (
          <li key={row.id}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener nofollow ugc"
                className="block transition-opacity hover:opacity-90"
              >
                {figure}
              </a>
            ) : (
              figure
            )}
          </li>
        )
      })}
    </ul>
  )
}
