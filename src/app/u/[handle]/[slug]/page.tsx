import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import { getModule } from '@/lib/modules/registry'
import PublicSurface from '@/components/public/PublicSurface'
import type { InstallRow, ProfileRow, RecordRow } from '@/lib/supabase/types'

/** Rendered per request: the response depends on the caller's session and on live data. */
export const dynamic = 'force-dynamic'


/** A single container on its own page — the target of a QR code or a short link. */
async function loadSurface(handle: string, slug: string) {
  const supabase = await createServerSupabase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .ilike('handle', handle)
    .maybeSingle<ProfileRow>()

  if (!profile || !profile.page_published) {
    return null
  }

  const { data: install } = await supabase
    .from('installs')
    .select('*')
    .eq('owner_id', profile.id)
    .eq('slug', slug)
    .maybeSingle<InstallRow>()

  if (!install) {
    return null
  }

  const manifest = getModule(install.module_id)

  if (!manifest?.publicSurface) {
    return null
  }

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('install_id', install.id)
    .eq('collection', manifest.publicSurface.collection)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<RecordRow[]>()

  return { profile, install, manifest, records: records ?? [] }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>
}): Promise<Metadata> {
  const { handle, slug } = await params
  const surface = await loadSurface(handle, slug)

  if (!surface) {
    return { title: 'Page not found' }
  }

  const owner = surface.profile.display_name || `@${surface.profile.handle}`

  return {
    title: `${surface.install.name} · ${owner}`,
    description: surface.manifest.tagline,
  }
}

export default async function InstallPublicPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>
}) {
  const { handle, slug } = await params
  const surface = await loadSurface(handle, slug)

  if (!surface) {
    notFound()
  }

  const { profile, install, manifest, records } = surface
  const owner = profile.display_name || `@${profile.handle}`

  return (
    <main className="min-h-screen bg-ink-50">
      <div className="h-2 w-full" style={{ backgroundColor: profile.accent }} />

      <div className="mx-auto max-w-xl px-5 pb-16 pt-8">
        <Link href={`/u/${profile.handle}`} className="text-sm text-ink-500 hover:text-ink-900">
          ← {owner}
        </Link>

        <h1 className="mb-6 mt-4 text-2xl font-semibold tracking-tight">{install.name}</h1>

        <PublicSurface
          install={install}
          manifest={manifest}
          accent={profile.accent}
          records={records}
        />

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
