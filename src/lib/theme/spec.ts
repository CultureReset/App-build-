import { z } from 'zod'

/**
 * The theme is how an owner redesigns their public page.
 *
 * It is deliberately a large set of validated knobs rather than free-form CSS.
 * Free-form styling from thousands of accounts would be an injection surface
 * and would make every third-party block unsafe to render on a shared page.
 * A wide, constrained system gets the same expressive range with none of that:
 * every value below is checked, and the runtime is the only thing that writes
 * markup.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #4d4de5.')

export const themeSchema = z.object({
  /** Preset this theme started from, kept so the editor can show provenance. */
  preset: z.string().max(40).default('clean'),

  mode: z.enum(['light', 'dark']).default('light'),

  /** Page background treatment. */
  background: z.enum(['solid', 'gradient', 'spotlight']).default('solid'),
  bgColor: hex.default('#f6f7f9'),
  bgColorAlt: hex.default('#ffffff'),

  accent: hex.default('#636ef1'),
  textColor: hex.default('#171a21'),
  mutedColor: hex.default('#65728e'),

  /** How every block container is drawn. */
  surface: z.enum(['card', 'flat', 'outline', 'glass']).default('card'),
  surfaceColor: hex.default('#ffffff'),

  font: z.enum(['sans', 'serif', 'rounded', 'mono', 'display']).default('sans'),
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).default('md'),
  density: z.enum(['compact', 'normal', 'roomy']).default('normal'),
  width: z.enum(['narrow', 'standard', 'wide']).default('standard'),

  buttonStyle: z.enum(['solid', 'soft', 'outline', 'pill']).default('solid'),

  /** The identity block at the top of the page. */
  header: z.enum(['centered', 'left', 'cover', 'minimal']).default('centered'),
  headerImage: z.string().url().max(2000).optional(),
  avatarShape: z.enum(['circle', 'rounded', 'square']).default('rounded'),

  /** Section headings above each block. */
  headings: z.enum(['plain', 'accent', 'uppercase', 'hidden']).default('plain'),
})

export type Theme = z.infer<typeof themeSchema>

export const defaultTheme: Theme = themeSchema.parse({})

/** Anything stored before a schema change still renders; unknown keys fall back. */
export function coerceTheme(input: unknown): Theme {
  const result = themeSchema.safeParse(input ?? {})
  return result.success ? result.data : defaultTheme
}

export const FONT_STACKS: Record<Theme['font'], string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
  rounded: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  display: "'Georgia', 'Iowan Old Style', ui-serif, serif",
}

const RADIUS: Record<Theme['radius'], string> = {
  none: '0px',
  sm: '6px',
  md: '12px',
  lg: '20px',
  full: '32px',
}

const DENSITY: Record<Theme['density'], { gap: string; pad: string; block: string }> = {
  compact: { gap: '0.5rem', pad: '0.75rem', block: '1.75rem' },
  normal: { gap: '0.75rem', pad: '1rem', block: '2.5rem' },
  roomy: { gap: '1rem', pad: '1.5rem', block: '3.5rem' },
}

const WIDTH: Record<Theme['width'], string> = {
  narrow: '30rem',
  standard: '38rem',
  wide: '56rem',
}

/** Mixes a hex colour toward white or black — used for derived tints. */
function shade(hexColor: string, amount: number): string {
  const value = hexColor.replace('#', '')
  const target = amount > 0 ? 255 : 0
  const ratio = Math.abs(amount)

  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16)
    return Math.round(channel + (target - channel) * ratio)
  })

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Readable foreground for a given background, by perceived luminance. */
export function contrastOn(hexColor: string): string {
  const value = hexColor.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

  return luminance > 0.6 ? '#12141a' : '#ffffff'
}

/**
 * Compiles a theme into CSS custom properties.
 *
 * Every value here originates from the validated schema above, so nothing an
 * owner types can escape into the stylesheet as arbitrary CSS.
 */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const density = DENSITY[theme.density]
  const isDark = theme.mode === 'dark'

  return {
    '--pg-font': FONT_STACKS[theme.font],
    '--pg-radius': RADIUS[theme.radius],
    '--pg-radius-inner': theme.radius === 'full' ? '999px' : RADIUS[theme.radius],
    '--pg-gap': density.gap,
    '--pg-pad': density.pad,
    '--pg-block-gap': density.block,
    '--pg-width': WIDTH[theme.width],
    '--pg-bg': theme.bgColor,
    '--pg-bg-alt': theme.bgColorAlt,
    '--pg-accent': theme.accent,
    '--pg-accent-contrast': contrastOn(theme.accent),
    '--pg-accent-soft': isDark ? shade(theme.accent, -0.6) : shade(theme.accent, 0.86),
    '--pg-text': theme.textColor,
    '--pg-muted': theme.mutedColor,
    '--pg-surface': theme.surface === 'flat' ? 'transparent' : theme.surfaceColor,
    '--pg-border':
      theme.surface === 'flat'
        ? 'transparent'
        : isDark
          ? shade(theme.surfaceColor, 0.16)
          : shade(theme.textColor, 0.86),
    '--pg-shadow':
      theme.surface === 'card'
        ? isDark
          ? '0 1px 2px rgba(0,0,0,0.5)'
          : '0 1px 2px rgba(16,20,30,0.06), 0 4px 12px rgba(16,20,30,0.04)'
        : 'none',
  }
}

export function pageBackground(theme: Theme): string {
  switch (theme.background) {
    case 'gradient':
      return `linear-gradient(160deg, ${theme.bgColorAlt} 0%, ${theme.bgColor} 55%)`
    case 'spotlight':
      return `radial-gradient(120% 70% at 50% 0%, ${theme.bgColorAlt} 0%, ${theme.bgColor} 60%)`
    default:
      return theme.bgColor
  }
}

/**
 * Starting points an owner can pick and then adjust. These exist so a page
 * looks considered on day one, not so it is locked to a look.
 */
export const THEME_PRESETS: { id: string; name: string; description: string; theme: Theme }[] = [
  {
    id: 'clean',
    name: 'Clean',
    description: 'Light, neutral, gets out of the way.',
    theme: themeSchema.parse({ preset: 'clean' }),
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark and high contrast, like the reference agent pages.',
    theme: themeSchema.parse({
      preset: 'midnight',
      mode: 'dark',
      background: 'spotlight',
      bgColor: '#0b0d12',
      bgColorAlt: '#161a24',
      surface: 'outline',
      surfaceColor: '#141821',
      accent: '#3d8bff',
      textColor: '#f4f6fa',
      mutedColor: '#98a2b8',
      radius: 'lg',
      header: 'cover',
      buttonStyle: 'solid',
    }),
  },
  {
    id: 'agent',
    name: 'Agent',
    description: 'Professional, photo-led, built for listings and lead capture.',
    theme: themeSchema.parse({
      preset: 'agent',
      mode: 'light',
      background: 'gradient',
      bgColor: '#eef1f6',
      bgColorAlt: '#ffffff',
      surface: 'card',
      surfaceColor: '#ffffff',
      accent: '#1f3b73',
      textColor: '#131722',
      mutedColor: '#5b6478',
      font: 'serif',
      radius: 'sm',
      width: 'wide',
      header: 'cover',
      avatarShape: 'circle',
      headings: 'uppercase',
      buttonStyle: 'solid',
    }),
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Loud and dark. Good for nightlife, gigs and DJs.',
    theme: themeSchema.parse({
      preset: 'neon',
      mode: 'dark',
      background: 'spotlight',
      bgColor: '#0a0612',
      bgColorAlt: '#1d1030',
      surface: 'glass',
      surfaceColor: '#1a1228',
      accent: '#c46bff',
      textColor: '#f7f2ff',
      mutedColor: '#a596c0',
      radius: 'lg',
      density: 'roomy',
      buttonStyle: 'pill',
      headings: 'uppercase',
    }),
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Soft and inviting. Suits cafés, kitchens and small shops.',
    theme: themeSchema.parse({
      preset: 'warm',
      mode: 'light',
      background: 'solid',
      bgColor: '#f6f1e8',
      bgColorAlt: '#fffdf9',
      surface: 'card',
      surfaceColor: '#fffdf9',
      accent: '#b5562a',
      textColor: '#231a12',
      mutedColor: '#7b6a58',
      font: 'serif',
      radius: 'md',
      density: 'roomy',
      buttonStyle: 'soft',
    }),
  },
  {
    id: 'brutal',
    name: 'Brutal',
    description: 'Hard edges, no shadows, maximum contrast.',
    theme: themeSchema.parse({
      preset: 'brutal',
      mode: 'light',
      background: 'solid',
      bgColor: '#ffffff',
      bgColorAlt: '#ffffff',
      surface: 'outline',
      surfaceColor: '#ffffff',
      accent: '#111111',
      textColor: '#000000',
      mutedColor: '#555555',
      font: 'mono',
      radius: 'none',
      density: 'compact',
      header: 'left',
      avatarShape: 'square',
      headings: 'uppercase',
      buttonStyle: 'outline',
    }),
  },
]

export function getPreset(id: string) {
  return THEME_PRESETS.find((preset) => preset.id === id)
}
