import { pageBackground, themeToCssVars, type Theme } from '@/lib/theme/spec'

/**
 * Applies a validated theme to everything inside it.
 *
 * The theme becomes CSS custom properties and a handful of data attributes;
 * the stylesheet in globals.css does the rest. No owner-authored CSS is ever
 * emitted, so restyling a page can never affect anything but its own look.
 */
export default function PageShell({
  theme,
  children,
}: {
  theme: Theme
  children: React.ReactNode
}) {
  const vars = themeToCssVars(theme)

  return (
    <div
      className="pg-root min-h-screen"
      data-surface={theme.surface}
      data-buttons={theme.buttonStyle}
      data-headings={theme.headings}
      data-header={theme.header}
      data-mode={theme.mode}
      style={{ ...vars, background: pageBackground(theme) } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
