import { EmptyBlock, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'
import type { RecordRow } from '@/lib/supabase/types'
import { embedSrc } from '@/lib/runtime/embeds'

export default function Embed({ surface, collection, records, variant }: TemplateProps) {
  const rows: { row: RecordRow; src: string }[] = []

  for (const row of visibleRecords(collection, records)) {
    const src = embedSrc(text(row, surface.linkField))

    if (src) {
      rows.push({ row, src })
    }
  }

  if (rows.length === 0) {
    return <EmptyBlock label="No videos yet." />
  }

  const shown = variant === 'feature' ? rows.slice(0, 1) : rows

  return (
    <div className="pg-stack">
      {shown.map(({ row, src }) => (
        <figure key={row.id}>
          <div className="pg-media aspect-video w-full">
            <iframe
              src={src}
              title={text(row, collection.titleField) || 'Video'}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
          {text(row, collection.titleField) ? (
            <figcaption className="pg-muted mt-2 text-sm">
              {text(row, collection.titleField)}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  )
}
