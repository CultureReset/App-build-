import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { listAuthoredModules } from '@/lib/modules/catalogue'
import NewModuleButton from '@/components/build/NewModuleButton'

export const metadata = { title: 'Build' }
export const dynamic = 'force-dynamic'

const VISIBILITY_COPY: Record<string, string> = {
  private: 'Only me',
  unlisted: 'Anyone with the link',
  public: 'In the store',
}

export default async function BuildPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const entries = await listAuthoredModules(supabase, user.id)

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Build</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Make your own app: say what it stores and how it looks, and the platform builds every
            screen for it. You never write code, and what you build can stay private, be shared by
            link, or go in the store for anyone to install.
          </p>
        </div>
        <NewModuleButton />
      </div>

      {entries.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-4xl">🧩</p>
          <h2 className="mt-4 text-lg font-medium">You have not built anything yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
            Start with what you need to keep track of — bookings, stock, sign-ups, jobs, anything.
            Name the fields, pick how it should look, and it works.
          </p>
          <div className="mt-6 flex justify-center">
            <NewModuleButton />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(({ listing, manifest }) => (
            <Link
              key={listing.id}
              href={`/dashboard/build/${listing.id}`}
              className="card group p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                  style={{ backgroundColor: `${manifest.accent}1a` }}
                >
                  {manifest.icon}
                </div>
                <span
                  className={`chip ${
                    listing.visibility === 'public'
                      ? 'bg-green-50 text-green-700'
                      : listing.visibility === 'unlisted'
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-ink-100 text-ink-600'
                  }`}
                >
                  {VISIBILITY_COPY[listing.visibility]}
                </span>
              </div>

              <h2 className="mt-4 font-medium group-hover:text-brand-700">{manifest.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-ink-500">{manifest.tagline}</p>

              <p className="mt-3 text-xs text-ink-400">
                v{manifest.version} · {listing.install_count}{' '}
                {listing.install_count === 1 ? 'install' : 'installs'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
