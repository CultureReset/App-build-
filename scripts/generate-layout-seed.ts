import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { BUILTIN_TEMPLATES } from '../src/lib/theme/templates.ts'

/**
 * Regenerates the built-in layout seed. Run with `npm run seed:layouts`.
 *
 * Like modules, layouts live in the database — these rows have no privileges
 * beyond an author-less "builtin" badge, and a user-published layout sits
 * beside them as an equal.
 */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

const rows = BUILTIN_TEMPLATES.map(
  (template) => `  (
    ${sqlString(template.slug)},
    ${sqlString(template.name)},
    ${sqlString(template.description)},
    ${sqlString(template.category)},
    ${sqlString(JSON.stringify(template.theme))}::jsonb,
    ${sqlString(JSON.stringify(template.plan))}::jsonb
  )`,
).join(',\n')

const sql = `-- ============================================================================
-- Seeds the page layouts that ship with the platform.
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   npm run seed:layouts
-- ============================================================================

insert into public.page_templates
  (slug, name, description, category, theme, plan, author_id, is_builtin, is_public)
select
  seed.slug,
  seed.name,
  seed.description,
  seed.category,
  seed.theme,
  seed.plan,
  null,
  true,
  true
from (values
${rows}
) as seed (slug, name, description, category, theme, plan)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      theme = excluded.theme,
      plan = excluded.plan,
      is_public = true;
`

const target = path.resolve(
  import.meta.dirname,
  '..',
  'supabase',
  'migrations',
  '0006_seed_builtin_layouts.sql',
)
writeFileSync(target, sql)
console.log(`Wrote ${BUILTIN_TEMPLATES.length} built-in layouts to ${path.basename(target)}`)
