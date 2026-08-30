import { pageBackground, themeToCssVars, type Theme } from '@/lib/theme/spec'

/**
 * A miniature of the real page, rendered with the same CSS variables and the
 * same classes the public page uses — so what you see here is genuinely what
 * ships, not an approximation.
 */
export default function ThemePreview({ theme }: { theme: Theme }) {
  const vars = themeToCssVars(theme)

  return (
    <div className="card overflow-hidden">
      <p className="border-b border-ink-200 bg-ink-50 px-3 py-2 text-xs font-medium text-ink-600">
        Live preview
      </p>

      <div
        className="pg-root p-4"
        data-surface={theme.surface}
        data-buttons={theme.buttonStyle}
        data-headings={theme.headings}
        data-header={theme.header}
        style={{ ...vars, background: pageBackground(theme) } as React.CSSProperties}
      >
        <div className={theme.header === 'centered' ? 'text-center' : ''}>
          <div
            className={`h-12 w-12 ${
              theme.avatarShape === 'circle'
                ? 'rounded-full'
                : theme.avatarShape === 'square'
                  ? 'rounded-none'
                  : 'rounded-xl'
            } ${theme.header === 'centered' ? 'mx-auto' : ''}`}
            style={{ background: 'var(--pg-accent)' }}
          />
          <p className="mt-2 text-sm font-semibold">Your name</p>
          <p className="pg-muted text-xs">What you do</p>
        </div>

        <div className="mt-4 space-y-[var(--pg-gap)]">
          <button type="button" className="pg-btn pg-btn-primary w-full text-xs" tabIndex={-1}>
            Get in touch
          </button>

          <h3 className="pg-heading pt-1 text-sm">Listings</h3>

          <div className="pg-surface pg-pad">
            <p className="text-xs font-medium">12 Alder Street</p>
            <p className="pg-accent mt-0.5 text-xs font-semibold">$540,000</p>
            <p className="pg-muted mt-0.5 text-[0.65rem]">3 bedrooms · 2 bathrooms</p>
          </div>

          <div className="pg-surface pg-pad">
            <p className="text-xs font-medium">8 Waverly Court</p>
            <p className="pg-accent mt-0.5 text-xs font-semibold">$725,000</p>
          </div>
        </div>
      </div>
    </div>
  )
}
