import Link from 'next/link'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col bg-ink-50">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink-900">
          Modular
        </Link>
      </header>

      <div className="flex flex-1 items-start justify-center px-6 pb-16 pt-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-7 mt-1.5 text-sm text-ink-500">{subtitle}</p>
          <div className="card p-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
