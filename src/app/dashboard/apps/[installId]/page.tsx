import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { installManifest } from '@/lib/modules/catalogue'
import { siteUrl } from '@/lib/supabase/env'
import CollectionManager from '@/components/runtime/CollectionManager'
import SettingsForm from '@/components/runtime/SettingsForm'
import InstallControls from '@/components/runtime/InstallControls'
import type { InstallRow, ProfileRow, RecordRow } from '@/lib/supabase/types'

export default async function InstallPage({
  params,
}: {
  params: Promise<{ installId: string }>
}) {
  const { installId } = await params
  const supabase = await createServerSupabase()

  const { data: install } = await supabase
    .from('installs')
    .select('*')
    .eq('id', installId)
    .maybeSingle<InstallRow>()

  if (!install) {
    notFound()
  }

  const manifest = installManifest(install)

  if (!manifest) {
    notFound()
  }

  const [{ data: records }, { data: profile }] = await Promise.all([
    supabase
      .from('records')
      .select('*')
      .eq('install_id', install.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
      .returns<RecordRow[]>(),
    supabase.from('profiles').select('*').eq('id', install.owner_id).maybeSingle<ProfileRow>(),
  ])

  const rows = records ?? []
  const currency = typeof install.config.currency === 'string' ? install.config.currency : '$'
  const acceptsSubmissions = install.public_write_collections.length > 0

  const publicUrl =
    profile && install.public_enabled && profile.page_published
      ? `${siteUrl()}/u/${profile.handle}/${install.slug}`
      : null

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-ink-500 hover:text-ink-900">
        ← My apps
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
            <h1 className="text-2xl font-semibold tracking-tight">{install.name}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {manifest.name} · v{install.module_version}
            </p>
          </div>
        </div>

        {publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-secondary text-sm"
          >
            View public page ↗
          </a>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {Object.entries(manifest.collections).map(([key, collection]) => (
            <CollectionManager
              key={key}
              installId={install.id}
              collectionKey={key}
              collection={collection}
              currency={currency}
              rows={rows.filter((row) => row.collection === key)}
            />
          ))}

          {manifest.settings.length > 0 ? (
            <SettingsForm
              installId={install.id}
              fields={manifest.settings}
              config={install.config}
            />
          ) : null}
        </div>

        <aside>
          <InstallControls
            installId={install.id}
            name={install.name}
            hasPublicSurface={Boolean(manifest.publicSurface)}
            acceptsSubmissions={acceptsSubmissions}
            publicEnabled={install.public_enabled}
            acceptingSubmissions={install.accepting_submissions}
            publicUrl={publicUrl}
            pagePublished={profile?.page_published ?? false}
          />
        </aside>
      </div>
    </div>
  )
}
