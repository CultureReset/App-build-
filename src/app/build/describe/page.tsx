import Link from 'next/link'
import StoreDescribe from '@/components/build/StoreDescribe'
import { storeAiAvailable } from '@/app/build/ai-actions'

export const metadata = { title: 'Describe your app' }
export const dynamic = 'force-dynamic'

export default async function StoreDescribePage() {
  const configured = await storeAiAvailable()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/build" className="text-sm text-ink-500 hover:text-ink-900">
        ← Build
      </Link>
      <h1 className="mb-1 mt-4 text-2xl font-semibold tracking-tight">Describe your app</h1>
      <p className="mb-6 text-sm text-ink-500">
        Say what you need, or tap the microphone and say it. You land in the same builder, and the
        result is a store manifest.
      </p>
      <StoreDescribe configured={configured} />
    </main>
  )
}
