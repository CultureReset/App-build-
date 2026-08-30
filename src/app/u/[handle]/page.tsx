import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import { getModule } from '@/lib/modules/registry'
import PublicSurface from '@/components/public/PublicSurface'
import type { InstallRow, ProfileRow, RecordRow } from '@/lib/supabase/types'

/** Rendered per request: the response depends on the caller's session and on live data. */
export const dynamic = 'force-dynamic'


/**
 * Loads a published page and everything visible on it.
 *
 * Every query here runs as `anon`, so RLS is what decides what comes back —
 * this code could not read an unpublished page even if it tried to.
 */
async function loadPage(handle: string) {
  const supabase = await createServerSupabase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .ilike('handle', handle)
    .maybeSingle<ProfileRow>()

  if (!profile || !profile.page_published) {
    return null
  }

  const { data: installs } = await supabase
    .from('installs')
    .select('*')
    .eq('owner_id', profile.id)
    .order('public_position', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<InstallRow[]>()

  const visible = (installs ?? []).filter((install) => getModule(install.module_id)?.publicSurface)

  const { data: records } = visible.length
    ? await supabase
        .from('records')
        .select('*')
        .in(
          'install_id',
          visible.map((install) => install.id),
        )
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
        .returns<RecordRow[]>()
    : { data: [] as RecordRow[] }

  return { profile, installs: visible, records: records ?? [] }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const page = await loadPage(handle)

  if (!page) {
    return { title: 'Page not found' }
  }

  const name = page.profile.display_name || `@${page.profile.handle}`

  return {
    title: name,
    description: page.profile.bio || `${name} on Modular`,
  }
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const page = await loadPage(handle)

  if (!page) {
    notFound()
  }

  const { profile, installs, records } = page
  const name = profile.display_name || `@${profile.handle}`

  return (
    <main className="min-h-screen bg-ink-50">
      <div
        className="h-28 w-full"
        style={{ background: `linear-gradient(135deg, ${profile.accent}, ${profile.accent}88)` }}
      />

      <div className="mx-auto max-w-xl px-5 pb-16">
        <div className="-mt-10">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-ink-50 text-2xl font-semibold text-white"
            style={{ backgroundColor: profile.accent }}
          >
            {name.replace('@', '').charAt(0).toUpperCase()}
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{name}</h1>
          {profile.bio ? (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{profile.bio}</p>
          ) : null}
        </div>

        {installs.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-400">
            Nothing here yet.
          </p>
        ) : (
          <div className="mt-9 space-y-9">
            {installs.map((install) => {
              const manifest = getModule(install.module_id)!

              return (
                <section key={install.id}>
                  <header className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">{install.name}</h2>
                    <Link
                      href={`/u/${profile.handle}/${install.slug}`}
                      className="shrink-0 text-xs text-ink-400 hover:text-ink-700"
                    >
                      Open ↗
                    </Link>
                  </header>

                  <PublicSurface
                    install={install}
                    manifest={manifest}
                    accent={profile.accent}
                    records={records.filter(
                      (row) =>
                        row.install_id === install.id &&
                        row.collection === manifest.publicSurface!.collection,
                    )}
                  />
                </section>
              )
            })}
          </div>
        )}

        <p className="mt-14 text-center text-xs text-ink-400">
          Built with{' '}
          <Link href="/" className="hover:text-ink-700">
            Modular
          </Link>
        </p>
      </div>
    </main>
  )
}
