import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getModule } from '@/lib/modules/registry'
import { siteUrl } from '@/lib/supabase/env'
import { coerceTheme } from '@/lib/theme/spec'
import { BUILTIN_TEMPLATES } from '@/lib/theme/templates'
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
      supabase
        .from('page_templates')
        .select('*')
        .eq('is_public', true)
        .order('use_count', { ascending: false })
        .limit(24)
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

  // Only apps that actually have a public face can be blocks on the page.
  const blocks: Block[] = (installs ?? [])
    .map((install) => ({ install, manifest: getModule(install.module_id) }))
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
        <LayoutGallery
          builtins={BUILTIN_TEMPLATES}
          community={community ?? []}
          mine={mine ?? []}
        />
      ) : null}
    </div>
  )
}
