import Link from 'next/link'
import { listModules } from '@/lib/modules/registry'

export default function LandingPage() {
  const modules = listModules()

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Modular</span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost text-ink-300 hover:bg-white/10 hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="btn bg-white text-ink-900 hover:bg-ink-100">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
        <p className="mb-5 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-ink-300">
          An app store for tools, not downloads
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Pick the tools you need.
          <br />
          <span className="text-ink-400">Skip everything underneath.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-300">
          Every app here is a self-contained container. Install one, edit it, choose whether the
          world sees it. Nothing you add can break anything you already have — and the code, the
          hosting and the security are never your problem.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/signup" className="btn bg-brand-500 px-5 py-2.5 text-white hover:bg-brand-600">
            Start building
          </Link>
          <Link
            href="/preview"
            className="btn border border-white/15 px-5 py-2.5 text-white hover:bg-white/10"
          >
            See a live example
          </Link>
        </div>
      </section>

      <section className="border-t border-white/10 bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
            How a container works
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Install it',
                body: 'Add an app from the store. It arrives with its own data, its own screens and its own settings — sealed off from everything else on your account.',
              },
              {
                step: '02',
                title: 'Make it yours',
                body: 'Edit the content directly. A menu, a link list, a request queue. No configuration files, no deploys — changes are live the moment you save.',
              },
              {
                step: '03',
                title: 'Show it, or don’t',
                body: 'Some apps have a public face you drop onto your page. Some run entirely behind the scenes. You decide per app, and you can turn it off any time.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <span className="text-xs font-semibold tracking-widest text-brand-300">
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">In the store today</h2>
            <p className="mt-2 text-sm text-ink-400">
              Each one installs in a click and works on its own.
            </p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div
              key={module.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg text-xl"
                style={{ backgroundColor: `${module.accent}22` }}
              >
                {module.icon}
              </div>
              <h3 className="mt-4 font-medium">{module.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{module.tagline}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                <span className="chip bg-white/5 text-ink-300">{module.category}</span>
                {module.publicSurface ? (
                  <span className="chip bg-white/5 text-ink-300">public page</span>
                ) : (
                  <span className="chip bg-white/5 text-ink-300">behind the scenes</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Modular</span>
          <span>Your apps live here. They stay here.</span>
        </div>
      </footer>
    </main>
  )
}
