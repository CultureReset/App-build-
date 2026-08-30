import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { listStoreModules } from '@/lib/modules/catalogue'
import InstallButton from '@/components/InstallButton'

export const metadata = { title: 'Store' }

/** Rendered per request: the catalogue is data, and changes as people publish. */
export const dynamic = 'force-dynamic'

export default async function StorePage() {
  const supabase = await createServerSupabase()

  const [entries, { data: installs }] = await Promise.all([
    listStoreModules(supabase),
    supabase.from('installs').select('module_id'),
  ])

  const counts = new Map<string, number>()
  for (const install of installs ?? []) {
    counts.set(install.module_id, (counts.get(install.module_id) ?? 0) + 1)
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Store</h1>
          <p className="mt-1 text-sm text-ink-500">
            Every app here is a definition someone published. Each one tells you what it can do
            before you add it.
          </p>
        </div>
        <Link href="/dashboard/build" className="btn-secondary">
          Build your own
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-4xl">🛒</p>
          <h2 className="mt-4 text-lg font-medium">The store is empty</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
            No modules have been published yet. Run the seed migration to load the apps that ship
            with the platform, or build the first one yourself.
          </p>
          <Link href="/dashboard/build" className="btn-primary mt-6">
            Build an app
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(({ listing, manifest }) => (
            <article key={listing.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                  style={{ backgroundColor: `${manifest.accent}1a` }}
                >
                  {manifest.icon}
                </div>
                <span className="chip bg-ink-100 text-ink-600">
                  {listing.pricing_model === 'free'
                    ? 'Free'
                    : `$${(listing.price_cents / 100).toFixed(2)}`}
                </span>
              </div>

              <h2 className="mt-4 font-medium">{manifest.name}</h2>
              <p className="mt-1 text-sm text-ink-500">{manifest.tagline}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">
                {manifest.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="chip bg-ink-100 text-ink-600">{manifest.category}</span>
                {manifest.publicSurface ? (
                  <span className="chip bg-ink-100 text-ink-600">has a public page</span>
                ) : (
                  <span className="chip bg-ink-100 text-ink-600">behind the scenes</span>
                )}
                <span className="chip bg-ink-100 text-ink-600">v{manifest.version}</span>
                {listing.is_builtin ? null : (
                  <span className="chip bg-brand-50 text-brand-700">by {manifest.author.name}</span>
                )}
              </div>

              <div className="mt-5 border-t border-ink-100 pt-4">
                <InstallButton
                  listingId={listing.id}
                  moduleName={manifest.name}
                  permissions={manifest.permissions}
                  installedCount={counts.get(manifest.id) ?? 0}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
