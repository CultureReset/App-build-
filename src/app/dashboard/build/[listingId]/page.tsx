import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { loadListing } from '@/lib/modules/catalogue'
import { draftFromManifest } from '@/lib/modules/derive'
import ModuleBuilder from '@/components/build/ModuleBuilder'

export const dynamic = 'force-dynamic'

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params
  const supabase = await createServerSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const entry = await loadListing(supabase, listingId)

  // Row Level Security already limits what can be read; this makes editing
  // someone else's module a 404 rather than a broken form.
  if (!entry || entry.listing.author_id !== user.id) {
    notFound()
  }

  const { listing, manifest } = entry

  return (
    <div>
      <Link href="/dashboard/build" className="text-sm text-ink-500 hover:text-ink-900">
        ← Build
      </Link>

      <header className="mb-7 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${manifest.accent}1a` }}
          >
            {manifest.icon}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{manifest.name}</h1>
            <p className="mt-1 font-mono text-xs text-ink-500">
              {listing.module_id} · v{manifest.version}
            </p>
          </div>
        </div>
      </header>

      <ModuleBuilder
        listingId={listing.id}
        initial={draftFromManifest(manifest)}
        visibility={listing.visibility}
        installCount={listing.install_count}
        published={listing.status === 'published'}
      />
    </div>
  )
}
