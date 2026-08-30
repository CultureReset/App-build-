import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { installManifest } from '@/lib/modules/catalogue'
import type { InstallRow, ProfileRow } from '@/lib/supabase/types'

export const metadata = { title: 'My apps' }

export default async function AppsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: installs }, { data: profile }] = await Promise.all([
    supabase
      .from('installs')
      .select('*')
      .order('created_at', { ascending: true })
      .returns<InstallRow[]>(),
    supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle<ProfileRow>(),
  ])

  const rows = installs ?? []

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My apps</h1>
          <p className="mt-1 text-sm text-ink-500">
            Each one is its own container. Editing one never touches another.
          </p>
        </div>
        <Link href="/dashboard/store" className="btn-primary">
          Browse the store
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-4xl">📦</p>
          <h2 className="mt-4 text-lg font-medium">Nothing installed yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
            Head to the store and add your first app. You can install as many as you like and
            remove any of them without affecting the rest.
          </p>
          <Link href="/dashboard/store" className="btn-primary mt-6">
            Browse the store
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((install) => {
            const manifest = installManifest(install)

            return (
              <Link
                key={install.id}
                href={`/dashboard/apps/${install.id}`}
                className="card group p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${manifest?.accent ?? '#636ef1'}1a` }}
                  >
                    {manifest?.icon ?? '📦'}
                  </div>
                  {install.public_enabled ? (
                    <span className="chip bg-green-50 text-green-700">Live</span>
                  ) : manifest?.publicSurface ? (
                    <span className="chip bg-ink-100 text-ink-600">Hidden</span>
                  ) : (
                    <span className="chip bg-ink-100 text-ink-600">Private</span>
                  )}
                </div>

                <h2 className="mt-4 font-medium group-hover:text-brand-700">{install.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-ink-500">
                  {manifest?.tagline ?? 'This app is no longer available.'}
                </p>

                {install.public_enabled && profile?.page_published ? (
                  <p className="mt-3 truncate font-mono text-xs text-ink-400">
                    /u/{profile.handle}/{install.slug}
                  </p>
                ) : null}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
