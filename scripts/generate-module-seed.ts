import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { BUILTIN_MODULES } from '../src/lib/modules/builtins.ts'

/**
 * Regenerates the seed migration from the built-in manifests.
 *
 * Run with `npm run seed:modules`. Keeping this generated means the manifests
 * in src/modules stay the single source of truth for what ships, while the
 * running application still reads every module from the database.
 */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

const rows = BUILTIN_MODULES.map((manifest) => {
  const pricing = manifest.pricing

  return `  (
    ${sqlString(manifest.id)},
    ${sqlString(manifest.version)},
    ${sqlString(JSON.stringify(manifest))}::jsonb,
    ${pricing.amountCents},
    ${sqlString(pricing.model)}
  )`
}).join(',\n')

const sql = `-- ============================================================================
-- Seeds the apps that ship with the platform.
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   npm run seed:modules
--
-- These rows are ordinary modules. The store, the runtime and the installer
-- treat them exactly like a module a user built; "is_builtin" only marks that
-- they have no author account behind them and cannot be edited or deleted
-- through the authoring policies.
-- ============================================================================

insert into public.module_listings
  (module_id, version, manifest, price_cents, pricing_model, author_id, is_builtin, status, visibility)
select
  seed.module_id,
  seed.version,
  seed.manifest,
  seed.price_cents,
  seed.pricing_model,
  null,
  true,
  'published',
  'public'
from (values
${rows}
) as seed (module_id, version, manifest, price_cents, pricing_model)
on conflict (module_id, version) do update
  set manifest = excluded.manifest,
      price_cents = excluded.price_cents,
      pricing_model = excluded.pricing_model,
      status = 'published',
      visibility = 'public';
`

const target = path.resolve(import.meta.dirname, '..', 'supabase', 'migrations', '0005_seed_builtin_modules.sql')
writeFileSync(target, sql)
console.log(`Wrote ${BUILTIN_MODULES.length} built-in modules to ${path.basename(target)}`)
