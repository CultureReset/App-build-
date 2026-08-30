import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { signOut } from '@/app/dashboard/actions'
import type { ProfileRow } from '@/lib/supabase/types'

/** Rendered per request: the response depends on the caller's session and on live data. */
export const dynamic = 'force-dynamic'


export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  const links = [
    { href: '/dashboard', label: 'My apps' },
    { href: '/dashboard/store', label: 'Store' },
    { href: '/dashboard/build', label: 'Build' },
    { href: '/dashboard/design', label: 'Public page' },
    { href: '/dashboard/settings/ai', label: 'AI' },
  ]

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              Modular
            </Link>
            <nav className="flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {profile ? (
              <span className="hidden text-sm text-ink-500 sm:inline">@{profile.handle}</span>
            ) : null}
            <form action={signOut}>
              <button type="submit" className="btn-ghost text-sm">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
