'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getModule } from '@/lib/modules/registry'
import { publicReadCollections, publicWriteCollections, resolveVariant } from '@/lib/modules/spec'
import { themeSchema, coerceTheme } from '@/lib/theme/spec'
import {
  getBuiltinTemplate,
  pageTemplateSchema,
  templatePlanSchema,
  type PageTemplate,
  type TemplateBlock,
} from '@/lib/theme/templates'
import type { InstallRow, PageTemplateRow, ProfileRow } from '@/lib/supabase/types'

export type ActionState = { error?: string; ok?: boolean }

async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { supabase, user }
}

function revalidateDesign() {
  revalidatePath('/dashboard/design')
  revalidatePath('/dashboard')
}

/** Saves the page theme after validating every value against the theme schema. */
export async function saveTheme(input: unknown): Promise<ActionState> {
  const parsed = themeSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That design could not be saved.' }
  }

  const { supabase, user } = await requireUser()
  const { error } = await supabase.from('profiles').update({ theme: parsed.data }).eq('id', user.id)

  if (error) {
    return { error: 'Could not save your design.' }
  }

  revalidateDesign()
  return { ok: true }
}

/** Chooses how one block presents itself, clamped to what its template supports. */
export async function setBlockVariant(installId: string, variant: string): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  const { data: install } = await supabase
    .from('installs')
    .select('*')
    .eq('id', installId)
    .eq('owner_id', user.id)
    .maybeSingle<InstallRow>()

  const surface = install ? getModule(install.module_id)?.publicSurface : undefined

  if (!install || !surface) {
    return { error: 'That block was not found.' }
  }

  const { error } = await supabase
    .from('installs')
    .update({ display_variant: resolveVariant(surface, variant) })
    .eq('id', install.id)

  if (error) {
    return { error: 'Could not change how that block displays.' }
  }

  revalidateDesign()
  return { ok: true }
}

/** An empty heading hides the section title entirely. */
export async function setBlockHeading(installId: string, heading: string): Promise<ActionState> {
  if (heading.length > 80) {
    return { error: 'Headings must be 80 characters or fewer.' }
  }

  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('installs')
    .update({ public_heading: heading.trim() })
    .eq('id', installId)
    .eq('owner_id', user.id)

  if (error) {
    return { error: 'Could not update that heading.' }
  }

  revalidateDesign()
  return { ok: true }
}

/** Moves a block up or down the public page, rewriting positions from the sorted order. */
export async function moveBlock(installId: string, direction: 'up' | 'down'): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  const { data: rows } = await supabase
    .from('installs')
    .select('id, public_position, module_id')
    .eq('owner_id', user.id)
    .order('public_position', { ascending: true })
    .order('created_at', { ascending: true })

  if (!rows) {
    return { error: 'Could not reorder that block.' }
  }

  const blocks = rows.filter((row) => getModule(row.module_id)?.publicSurface)
  const index = blocks.findIndex((row) => row.id === installId)
  const target = direction === 'up' ? index - 1 : index + 1

  if (index === -1 || target < 0 || target >= blocks.length) {
    return { ok: true }
  }

  const reordered = [...blocks]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved)

  for (const [position, row] of reordered.entries()) {
    if (row.public_position === position) {
      continue
    }

    await supabase.from('installs').update({ public_position: position }).eq('id', row.id)
  }

  revalidateDesign()
  return { ok: true }
}

/**
 * Applies a layout to the caller's page.
 *
 * Deliberately additive: apps already installed are reused and repositioned,
 * missing ones are installed, and anything not in the layout keeps its data and
 * simply moves below. Applying a layout never deletes a block or its content.
 */
export async function applyTemplate(source: {
  builtinSlug?: string
  templateId?: string
}): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  let template: PageTemplate | undefined
  let templateId: string | undefined

  if (source.builtinSlug) {
    template = getBuiltinTemplate(source.builtinSlug)
  } else if (source.templateId) {
    const { data } = await supabase
      .from('page_templates')
      .select('*')
      .eq('id', source.templateId)
      .maybeSingle<PageTemplateRow>()

    if (data) {
      // A stored layout is re-validated before use, exactly like a manifest.
      const parsed = pageTemplateSchema.safeParse({
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: data.category,
        theme: coerceTheme(data.theme),
        plan: data.plan,
      })

      if (parsed.success) {
        template = parsed.data
        templateId = data.id
      }
    }
  }

  if (!template) {
    return { error: 'That layout could not be found.' }
  }

  const { data: existing } = await supabase
    .from('installs')
    .select('*')
    .eq('owner_id', user.id)
    .returns<InstallRow[]>()

  const available = [...(existing ?? [])]
  const claimed = new Set<string>()
  let position = 0

  for (const block of template.plan as TemplateBlock[]) {
    const manifest = getModule(block.module_id)

    if (!manifest?.publicSurface) {
      continue
    }

    const reuse = available.find(
      (install) => install.module_id === block.module_id && !claimed.has(install.id),
    )

    const variant = resolveVariant(manifest.publicSurface, block.display_variant)

    if (reuse) {
      claimed.add(reuse.id)
      await supabase
        .from('installs')
        .update({
          public_enabled: true,
          public_position: position,
          display_variant: variant,
          public_heading: block.heading ?? null,
        })
        .eq('id', reuse.id)
    } else {
      const base = (block.name ?? manifest.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)

      const taken = new Set(available.map((install) => install.slug))
      let slug = base || manifest.id
      let counter = 2

      while (taken.has(slug)) {
        slug = `${base}-${counter}`
        counter += 1
      }

      const defaults: Record<string, unknown> = {}
      for (const field of manifest.settings) {
        if (field.defaultValue !== undefined) {
          defaults[field.key] = field.defaultValue
        }
      }

      const { data: inserted } = await supabase
        .from('installs')
        .insert({
          owner_id: user.id,
          module_id: manifest.id,
          module_version: manifest.version,
          slug,
          name: block.name ?? manifest.name,
          config: defaults,
          granted_permissions: manifest.permissions,
          public_read_collections: publicReadCollections(manifest),
          public_write_collections: publicWriteCollections(manifest),
          public_enabled: true,
          public_position: position,
          display_variant: variant,
          public_heading: block.heading ?? null,
        })
        .select('*')
        .maybeSingle<InstallRow>()

      if (inserted) {
        available.push(inserted)
        claimed.add(inserted.id)
      }
    }

    position += 1
  }

  // Everything the layout did not mention keeps its content and moves below.
  for (const install of available) {
    if (claimed.has(install.id)) {
      continue
    }

    await supabase.from('installs').update({ public_position: position }).eq('id', install.id)
    position += 1
  }

  await supabase.from('profiles').update({ theme: template.theme }).eq('id', user.id)

  if (templateId) {
    await supabase.rpc('increment_template_use', { p_template_id: templateId })
  }

  revalidateDesign()
  return { ok: true }
}

/**
 * Publishes the caller's current page design as a layout others can apply.
 *
 * Only the shape travels: the theme and the ordered list of blocks. No records,
 * no settings, no submissions — nothing an owner would not want copied.
 */
export async function publishLayout(input: {
  name: string
  description: string
  category: string
  isPublic: boolean
}): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  const [{ data: profile }, { data: installs }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>(),
    supabase
      .from('installs')
      .select('*')
      .eq('owner_id', user.id)
      .eq('public_enabled', true)
      .order('public_position', { ascending: true })
      .returns<InstallRow[]>(),
  ])

  if (!profile) {
    return { error: 'Could not read your page.' }
  }

  const plan = (installs ?? [])
    .filter((install) => getModule(install.module_id)?.publicSurface)
    .map((install) => ({
      module_id: install.module_id,
      name: install.name,
      heading: install.public_heading ?? undefined,
      display_variant: install.display_variant ?? undefined,
    }))

  if (plan.length === 0) {
    return { error: 'Switch on at least one block before publishing a layout.' }
  }

  const base = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  const candidate = pageTemplateSchema.safeParse({
    slug: `${base || 'layout'}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category,
    theme: coerceTheme(profile.theme),
    plan: templatePlanSchema.parse(plan),
  })

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? 'That layout could not be published.' }
  }

  const { error } = await supabase.from('page_templates').insert({
    author_id: user.id,
    slug: candidate.data.slug,
    name: candidate.data.name,
    description: candidate.data.description,
    category: candidate.data.category,
    theme: candidate.data.theme,
    plan: candidate.data.plan,
    is_public: input.isPublic,
    is_builtin: false,
  })

  if (error) {
    return { error: 'Could not publish that layout.' }
  }

  revalidateDesign()
  return { ok: true }
}

export async function deleteLayout(templateId: string): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('page_templates')
    .delete()
    .eq('id', templateId)
    .eq('author_id', user.id)

  if (error) {
    return { error: 'Could not delete that layout.' }
  }

  revalidateDesign()
  return { ok: true }
}
