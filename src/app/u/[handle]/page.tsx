import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import { installManifest } from '@/lib/modules/catalogue'
import { coerceTheme } from '@/lib/theme/spec'
import PageShell from '@/components/public/PageShell'
import ProfileHeader from '@/components/public/ProfileHeader'
import PublicSurface from '@/components/public/PublicSurface'
import type { InstallRow, ProfileRow, RecordRow } from '@/lib/supabase/types'

/** Rendered per request: the response depends on the caller's session and on live data. */
export const dynamic = 'force-dynamic'

/**
 * Loads a published page and everything visible on it.
 *
 * Every query here runs as `anon`, so Row Level Security is what decides what
 * comes back — this code could not read an unpublished page even if it tried.
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

  const visible = (installs ?? []).filter((install) => installManifest(install)?.publicSurface)

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
    description: page.profile.tagline || page.profile.bio || `${name} on Modular`,
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
  const theme = coerceTheme(profile.theme)

  return (
    <PageShell theme={theme}>
      <main className="pg-shell mx-auto px-5 pb-20">
        <ProfileHeader profile={profile} theme={theme} />

        {installs.length === 0 ? (
          <p
            className="pg-muted mt-10 rounded-[var(--pg-radius)] border border-dashed px-4 py-10 text-center text-sm"
            style={{ borderColor: 'var(--pg-border)' }}
          >
            Nothing here yet.
          </p>
        ) : (
          <div className="pg-blocks mt-[var(--pg-block-gap)]">
            {installs.map((install) => {
              const manifest = installManifest(install)!
              const heading = install.public_heading ?? install.name

              return (
                <section key={install.id}>
                  {heading ? (
                    <h2 className="pg-heading mb-3 text-lg">{heading}</h2>
                  ) : null}

                  <PublicSurface
                    install={install}
                    manifest={manifest}
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

        <p className="pg-muted mt-16 text-center text-xs opacity-70">
          Built with{' '}
          <Link href="/" className="underline-offset-4 hover:underline">
            Modular
          </Link>
        </p>
      </main>
    </PageShell>
  )
}
