import { createServerSupabase } from '@/lib/supabase/server'
import { listModules } from '@/lib/modules/registry'
import InstallButton from '@/components/InstallButton'

export const metadata = { title: 'Store' }

export default async function StorePage() {
  const supabase = await createServerSupabase()
  const { data: installs } = await supabase.from('installs').select('module_id')

  const counts = new Map<string, number>()
  for (const install of installs ?? []) {
    counts.set(install.module_id, (counts.get(install.module_id) ?? 0) + 1)
  }

  const modules = listModules()

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Store</h1>
        <p className="mt-1 text-sm text-ink-500">
          Install what you need. Every app tells you what it can do before you add it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <article key={module.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: `${module.accent}1a` }}
              >
                {module.icon}
              </div>
              <span className="chip bg-ink-100 text-ink-600">
                {module.pricing.model === 'free'
                  ? 'Free'
                  : `$${(module.pricing.amountCents / 100).toFixed(2)}`}
              </span>
            </div>

            <h2 className="mt-4 font-medium">{module.name}</h2>
            <p className="mt-1 text-sm text-ink-500">{module.tagline}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">{module.description}</p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="chip bg-ink-100 text-ink-600">{module.category}</span>
              {module.publicSurface ? (
                <span className="chip bg-ink-100 text-ink-600">has a public page</span>
              ) : (
                <span className="chip bg-ink-100 text-ink-600">behind the scenes</span>
              )}
              <span className="chip bg-ink-100 text-ink-600">v{module.version}</span>
            </div>

            <div className="mt-5 border-t border-ink-100 pt-4">
              <InstallButton
                moduleId={module.id}
                moduleName={module.name}
                permissions={module.permissions}
                installedCount={counts.get(module.id) ?? 0}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
