import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { installManifest, listStoreModules } from '@/lib/modules/catalogue'
import { siteUrl } from '@/lib/supabase/env'
import { coerceTheme } from '@/lib/theme/spec'
import ProfileForm from '@/components/design/ProfileForm'
import ThemeEditor from '@/components/design/ThemeEditor'
import BlockManager, { type Block } from '@/components/design/BlockManager'
import LayoutGallery from '@/components/design/LayoutGallery'
import type { InstallRow, PageTemplateRow, ProfileRow } from '@/lib/supabase/types'

export const metadata = { title: 'Public page' }

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'design', label: 'Design' },
  { id: 'layouts', label: 'Layouts' },
] as const

type TabId = (typeof TABS)[number]['id']

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const active: TabId = TABS.some((entry) => entry.id === tab) ? (tab as TabId) : 'details'

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: installs }, { data: community }, { data: mine }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>(),
      supabase
        .from('installs')
        .select('*')
        .eq('owner_id', user.id)
        .order('public_position', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<InstallRow[]>(),
      // Built-in and user-published layouts are the same kind of row; Row Level
      // Security decides which of them this caller may read.
      supabase
        .from('page_templates')
        .select('*')
        .eq('is_public', true)
        .order('is_builtin', { ascending: false })
        .order('use_count', { ascending: false })
        .limit(48)
        .returns<PageTemplateRow[]>(),
      supabase
        .from('page_templates')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .returns<PageTemplateRow[]>(),
    ])

  if (!profile) {
    redirect('/login')
  }

  // Layouts name modules by id; the gallery needs their icons, and the
  // catalogue lives in the database rather than in code.
  // One list: public layouts plus the caller's own drafts, deduplicated, with
  // ownership resolved here rather than in the browser.
  const authored = new Set((mine ?? []).map((row) => row.id))
  const seen = new Set<string>()
  const layouts: PageTemplateRow[] = []

  for (const row of [...(mine ?? []), ...(community ?? [])]) {
    if (seen.has(row.id)) {
      continue
    }

    seen.add(row.id)
    layouts.push({ ...row, mine: authored.has(row.id) })
  }

  const moduleIcons: Record<string, { icon: string; name: string }> = {}
  for (const entry of await listStoreModules(supabase)) {
    moduleIcons[entry.manifest.id] = { icon: entry.manifest.icon, name: entry.manifest.name }
  }

  // Only apps that actually have a public face can be blocks on the page.
  const blocks: Block[] = (installs ?? [])
    .map((install) => ({ install, manifest: installManifest(install) }))
    .filter((entry): entry is Block => Boolean(entry.manifest?.publicSurface))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Public page</h1>
        <p className="mt-1 text-sm text-ink-500">
          One link carrying every block you switched on — designed however you want it.
        </p>
      </div>

      <nav className="mb-6 flex gap-1 border-b border-ink-200">
        {TABS.map((entry) => (
          <Link
            key={entry.id}
            href={`/dashboard/design?tab=${entry.id}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              entry.id === active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {active === 'details' ? <ProfileForm profile={profile} baseUrl={siteUrl()} /> : null}
      {active === 'blocks' ? <BlockManager blocks={blocks} /> : null}
      {active === 'design' ? <ThemeEditor initial={coerceTheme(profile.theme)} /> : null}
      {active === 'layouts' ? (
        <LayoutGallery templates={layouts} moduleIcons={moduleIcons} />
      ) : null}
    </div>
  )
}
