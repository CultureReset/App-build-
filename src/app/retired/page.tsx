import Link from 'next/link'

export const metadata = { title: 'Moved' }

/**
 * Where the retired login, dashboard, store and public pages send people
 * while APP_BUILD_LEGACY_PLATFORM is off (src/lib/legacy.ts).
 */
export default function RetiredPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-2xl font-semibold tracking-tight">This part has moved</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        Sign-in, installed apps and the store now live in the business app, and every app is drawn
        there, on the public page and on the TV by the shared app engine. What stays here is the app
        builder: describe or build an app, and publish it to the store.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/build" className="btn-primary">
          Open the app builder
        </Link>
        <Link href="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </main>
  )
}
