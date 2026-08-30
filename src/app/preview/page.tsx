import Link from 'next/link'
import { getPreset, THEME_PRESETS } from '@/lib/theme/spec'
import { BUILTIN_TEMPLATES } from '@/lib/theme/templates'
import { demoBlocks, demoProfile } from '@/lib/demo/page'
import PageShell from '@/components/public/PageShell'
import ProfileHeader from '@/components/public/ProfileHeader'
import PublicSurface from '@/components/public/PublicSurface'

export const metadata = {
  title: 'Live example',
  description: 'A real public page rendered by the platform runtime.',
}

/**
 * A live example of the public front end, with sample content.
 *
 * It renders through the exact components a real page uses, so switching a
 * theme here shows precisely what an owner would get. Nothing is mocked but
 * the data.
 */
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  const { theme: requested } = await searchParams
  const preset = getPreset(requested ?? 'agent') ?? getPreset('agent')!
  const blocks = demoBlocks()

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="font-semibold tracking-tight text-white">
              Modular
            </Link>
            <p className="mt-0.5 text-xs text-ink-400">
              A real page, rendered by the runtime. Switch the look to see the same blocks
              restyled.
            </p>
          </div>
          <Link href="/signup" className="btn bg-white text-sm text-ink-900 hover:bg-ink-100">
            Build your own
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex flex-wrap gap-1.5">
          {THEME_PRESETS.map((option) => (
            <Link
              key={option.id}
              href={`/preview?theme=${option.id}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                option.id === preset.id
                  ? 'border-white/40 bg-white/15 text-white'
                  : 'border-white/10 text-ink-300 hover:bg-white/10'
              }`}
            >
              {option.name}
            </Link>
          ))}
        </div>

        <p className="mt-3 text-xs text-ink-500">
          Same blocks, same content, same components — only the theme changed. An owner sets this
          from their dashboard without touching code.
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <PageShell theme={preset.theme}>
            <main className="pg-shell mx-auto px-5 pb-16">
              <ProfileHeader profile={demoProfile} theme={preset.theme} />

              <div className="pg-blocks mt-[var(--pg-block-gap)]">
                {blocks.map(({ install, manifest, records }) => (
                  <section key={install.id}>
                    {install.public_heading ? (
                      <h2 className="pg-heading mb-3 text-lg">{install.public_heading}</h2>
                    ) : null}

                    <PublicSurface install={install} manifest={manifest} records={records} />
                  </section>
                ))}
              </div>
            </main>
          </PageShell>
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
            Layouts that ship with the platform
          </h2>
          <p className="mt-2 text-sm text-ink-400">
            Each one applies a look and installs its blocks in order. Anyone can publish their own
            for others to start from.
          </p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BUILTIN_TEMPLATES.map((template) => (
              <li
                key={template.slug}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex gap-1">
                  {[
                    template.theme.bgColor,
                    template.theme.surfaceColor,
                    template.theme.accent,
                  ].map((colour) => (
                    <span
                      key={colour}
                      className="h-5 w-5 rounded border border-white/10"
                      style={{ backgroundColor: colour }}
                    />
                  ))}
                </div>
                <p className="mt-2.5 font-medium text-white">{template.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-400">{template.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
