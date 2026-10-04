import StoreBuilder from '@/components/build/StoreBuilder'
import { storeAiAvailable } from '@/app/build/ai-actions'

export const metadata = { title: 'Build an app' }
export const dynamic = 'force-dynamic'

/**
 * The app builder, without App-build-'s own login or store. It produces an
 * engine manifest for the Paperclip store (components/build/ManifestPanel).
 */
export default async function BuildPage() {
  const describeAvailable = await storeAiAvailable()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Build an app</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">
        An app is a definition, not code. Build it here, then publish it to the store; it is drawn by
        the same engine on the business app, the public page and the TV.
      </p>
      <StoreBuilder describeAvailable={describeAvailable} />
    </main>
  )
}
