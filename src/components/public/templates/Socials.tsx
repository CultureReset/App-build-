import { EmptyBlock, safeHref, text, visibleRecords } from './shared'
import type { TemplateProps } from '../types'

const NETWORKS: Record<string, { label: string; glyph: string }> = {
  instagram: { label: 'Instagram', glyph: 'IG' },
  facebook: { label: 'Facebook', glyph: 'f' },
  linkedin: { label: 'LinkedIn', glyph: 'in' },
  youtube: { label: 'YouTube', glyph: '▶' },
  tiktok: { label: 'TikTok', glyph: '♪' },
  x: { label: 'X', glyph: '𝕏' },
  whatsapp: { label: 'WhatsApp', glyph: '✆' },
  threads: { label: 'Threads', glyph: '@' },
  pinterest: { label: 'Pinterest', glyph: 'P' },
  spotify: { label: 'Spotify', glyph: '♫' },
  website: { label: 'Website', glyph: '⌘' },
}

/** A compact row of profiles, rendered as icons, buttons or plain text. */
export default function Socials({ surface, collection, records, variant }: TemplateProps) {
  const rows = visibleRecords(collection, records)

  if (rows.length === 0) {
    return <EmptyBlock label="No profiles yet." />
  }

  return (
    <ul className="pg-inline-row flex flex-wrap items-center gap-[var(--pg-gap)]">
      {rows.map((row) => {
        const href = safeHref(text(row, surface.linkField))

        if (!href) {
          return null
        }

        const key = text(row, collection.titleField)
        const network = NETWORKS[key] ?? { label: key || 'Link', glyph: '↗' }

        return (
          <li key={row.id}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener nofollow ugc me"
              aria-label={network.label}
              title={network.label}
              className={
                variant === 'icons'
                  ? 'pg-surface flex h-11 w-11 items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80'
                  : variant === 'buttons'
                    ? 'pg-btn pg-btn-secondary'
                    : 'pg-muted text-sm underline-offset-4 hover:underline'
              }
            >
              {variant === 'icons' ? (
                <span aria-hidden>{network.glyph}</span>
              ) : (
                <>
                  {variant === 'buttons' ? <span aria-hidden>{network.glyph}</span> : null}
                  <span>{network.label}</span>
                </>
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
