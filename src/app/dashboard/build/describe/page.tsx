import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { isAiConfigured } from '@/lib/ai/client'
import DescribeBuilder from '@/components/build/DescribeBuilder'

export const metadata = { title: 'Describe your app' }
export const dynamic = 'force-dynamic'

export default async function DescribePage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/build" className="text-sm text-ink-500 hover:text-ink-900">
        ← Build
      </Link>

      <h1 className="mb-1 mt-4 text-2xl font-semibold tracking-tight">Describe your app</h1>
      <p className="mb-6 text-sm text-ink-500">
        Say what you need. You&rsquo;ll land in the same editor a hand-built app uses, so you can
        change anything before it goes live.
      </p>

      <DescribeBuilder configured={isAiConfigured()} />
    </div>
  )
}
