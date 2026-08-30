'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveTheme } from '@/app/dashboard/design/actions'
import { THEME_PRESETS, coerceTheme, type Theme } from '@/lib/theme/spec'
import ThemePreview from '@/components/design/ThemePreview'

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              option.value === value
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Colour({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-ink-200 bg-white p-1"
          aria-label={label}
        />
        <span className="font-mono text-xs text-ink-500">{value}</span>
      </div>
    </div>
  )
}

/**
 * The design surface. Every control maps to one validated field of the theme
 * schema — which is how an owner gets real design freedom without the platform
 * ever accepting arbitrary CSS.
 */
export default function ThemeEditor({ initial }: { initial: Theme }) {
  const router = useRouter()
  const [theme, setTheme] = useState<Theme>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof Theme>(key: K, value: Theme[K]) {
    setTheme((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      setError(null)
      const result = await saveTheme(theme)

      if (result.error) {
        setError(result.error)
        return
      }

      setSaved(true)
      router.refresh()
    })
  }

  const dirty = JSON.stringify(theme) !== JSON.stringify(initial)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="font-medium">Start from a look</h2>
          <p className="mb-4 mt-0.5 text-sm text-ink-500">
            Pick one, then change anything you want underneath.
          </p>

          <div className="grid gap-2 sm:grid-cols-3">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setTheme(coerceTheme(preset.theme))
                  setSaved(false)
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  theme.preset === preset.id
                    ? 'border-brand-500 ring-2 ring-brand-500/20'
                    : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <div className="flex gap-1">
                  {[preset.theme.bgColor, preset.theme.surfaceColor, preset.theme.accent].map(
                    (colour) => (
                      <span
                        key={colour}
                        className="h-5 w-5 rounded border border-black/10"
                        style={{ backgroundColor: colour }}
                      />
                    ),
                  )}
                </div>
                <p className="mt-2 text-sm font-medium">{preset.name}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-500">{preset.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="card space-y-5 p-5">
          <h2 className="font-medium">Colour</h2>

          <Choice
            label="Mode"
            value={theme.mode}
            onChange={(value) => set('mode', value)}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />

          <Choice
            label="Background"
            value={theme.background}
            onChange={(value) => set('background', value)}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'gradient', label: 'Gradient' },
              { value: 'spotlight', label: 'Spotlight' },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Colour label="Page" value={theme.bgColor} onChange={(v) => set('bgColor', v)} />
            <Colour label="Second tone" value={theme.bgColorAlt} onChange={(v) => set('bgColorAlt', v)} />
            <Colour label="Accent" value={theme.accent} onChange={(v) => set('accent', v)} />
            <Colour label="Blocks" value={theme.surfaceColor} onChange={(v) => set('surfaceColor', v)} />
            <Colour label="Text" value={theme.textColor} onChange={(v) => set('textColor', v)} />
            <Colour label="Muted text" value={theme.mutedColor} onChange={(v) => set('mutedColor', v)} />
          </div>
        </section>

        <section className="card space-y-5 p-5">
          <h2 className="font-medium">Shape and type</h2>

          <Choice
            label="Block style"
            value={theme.surface}
            onChange={(value) => set('surface', value)}
            options={[
              { value: 'card', label: 'Card' },
              { value: 'outline', label: 'Outline' },
              { value: 'flat', label: 'Flat' },
              { value: 'glass', label: 'Glass' },
            ]}
          />

          <Choice
            label="Corners"
            value={theme.radius}
            onChange={(value) => set('radius', value)}
            options={[
              { value: 'none', label: 'Square' },
              { value: 'sm', label: 'Slight' },
              { value: 'md', label: 'Rounded' },
              { value: 'lg', label: 'Soft' },
              { value: 'full', label: 'Pill' },
            ]}
          />

          <Choice
            label="Typeface"
            value={theme.font}
            onChange={(value) => set('font', value)}
            options={[
              { value: 'sans', label: 'Sans' },
              { value: 'serif', label: 'Serif' },
              { value: 'rounded', label: 'Rounded' },
              { value: 'mono', label: 'Mono' },
              { value: 'display', label: 'Display' },
            ]}
          />

          <Choice
            label="Buttons"
            value={theme.buttonStyle}
            onChange={(value) => set('buttonStyle', value)}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'soft', label: 'Soft' },
              { value: 'outline', label: 'Outline' },
              { value: 'pill', label: 'Pill' },
            ]}
          />

          <Choice
            label="Spacing"
            value={theme.density}
            onChange={(value) => set('density', value)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'roomy', label: 'Roomy' },
            ]}
          />

          <Choice
            label="Page width"
            value={theme.width}
            onChange={(value) => set('width', value)}
            options={[
              { value: 'narrow', label: 'Narrow' },
              { value: 'standard', label: 'Standard' },
              { value: 'wide', label: 'Wide' },
            ]}
          />
        </section>

        <section className="card space-y-5 p-5">
          <h2 className="font-medium">Header and headings</h2>

          <Choice
            label="Header layout"
            value={theme.header}
            onChange={(value) => set('header', value)}
            options={[
              { value: 'centered', label: 'Centered' },
              { value: 'left', label: 'Left' },
              { value: 'cover', label: 'Cover image' },
              { value: 'minimal', label: 'Text only' },
            ]}
          />

          <Choice
            label="Photo shape"
            value={theme.avatarShape}
            onChange={(value) => set('avatarShape', value)}
            options={[
              { value: 'circle', label: 'Circle' },
              { value: 'rounded', label: 'Rounded' },
              { value: 'square', label: 'Square' },
            ]}
          />

          <Choice
            label="Section headings"
            value={theme.headings}
            onChange={(value) => set('headings', value)}
            options={[
              { value: 'plain', label: 'Plain' },
              { value: 'accent', label: 'Accent' },
              { value: 'uppercase', label: 'Small caps' },
              { value: 'hidden', label: 'Hidden' },
            ]}
          />

          {theme.header === 'cover' ? (
            <div>
              <label className="label" htmlFor="cover-image">
                Cover image URL
              </label>
              <input
                id="cover-image"
                className="field"
                value={theme.headerImage ?? ''}
                placeholder="https://…"
                onChange={(event) =>
                  set('headerImage', (event.target.value || undefined) as Theme['headerImage'])
                }
              />
              <p className="mt-1 text-xs text-ink-500">
                Leave blank for a gradient built from your accent colour.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <ThemePreview theme={theme} />

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="button"
          className="btn-primary w-full"
          onClick={save}
          disabled={pending || !dirty}
        >
          {pending ? 'Saving…' : dirty ? 'Save design' : saved ? 'Saved' : 'No changes'}
        </button>
      </aside>
    </div>
  )
}
