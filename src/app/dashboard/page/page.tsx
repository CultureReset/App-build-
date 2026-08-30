import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getModule } from '@/lib/modules/registry'
import { siteUrl } from '@/lib/supabase/env'
import PageSettings from '@/components/PageSettings'
import type { InstallRow, ProfileRow } from '@/lib/supabase/types'

export const metadata = { title: 'Public page' }

export default async function PublicPageSettings() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: installs }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>(),
    supabase
      .from('installs')
      .select('*')
      .order('public_position', { ascending: true })
      .returns<InstallRow[]>(),
  ])

  if (!profile) {
    redirect('/login')
  }

  const publishable = (installs ?? []).filter((install) => getModule(install.module_id)?.publicSurface)

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Public page</h1>
        <p className="mt-1 text-sm text-ink-500">
          One link that carries every app you chose to show.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PageSettings profile={profile} baseUrl={siteUrl()} />

        <aside className="card p-5">
          <h2 className="font-medium">Sections on your page</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Toggle these inside each app.
          </p>

          {publishable.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">
              None of your apps have a public face yet.{' '}
              <Link href="/dashboard/store" className="text-brand-600 hover:underline">
                Browse the store
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {publishable.map((install) => {
                const manifest = getModule(install.module_id)

                return (
                  <li key={install.id}>
                    <Link
                      href={`/dashboard/apps/${install.id}`}
                      className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2 hover:bg-ink-50"
                    >
                      <span className="text-lg">{manifest?.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{install.name}</span>
                      {install.public_enabled ? (
                        <span className="chip bg-green-50 text-green-700">Shown</span>
                      ) : (
                        <span className="chip bg-ink-100 text-ink-500">Hidden</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
