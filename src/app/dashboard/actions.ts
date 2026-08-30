'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getModule } from '@/lib/modules/registry'
import { publicReadCollections, publicWriteCollections } from '@/lib/modules/spec'
import { validateFields, validateOwnerRecord } from '@/lib/runtime/values'
import type { InstallRow } from '@/lib/supabase/types'

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

/**
 * Loads an install the caller owns, together with its module manifest.
 * Every action that touches install-scoped data goes through here, so an
 * unauthorised id fails before any work happens (and RLS backs it up).
 */
async function requireOwnedInstall(installId: string) {
  const { supabase, user } = await requireUser()

  const { data, error } = await supabase
    .from('installs')
    .select('*')
    .eq('id', installId)
    .eq('owner_id', user.id)
    .maybeSingle<InstallRow>()

  if (error || !data) {
    throw new Error('That app was not found on your account.')
  }

  const manifest = getModule(data.module_id)

  if (!manifest) {
    throw new Error(`The "${data.module_id}" app is no longer available.`)
  }

  return { supabase, user, install: data, manifest }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function installModule(moduleId: string): Promise<ActionState> {
  const manifest = getModule(moduleId)

  if (!manifest) {
    return { error: 'That app does not exist.' }
  }

  const { supabase, user } = await requireUser()

  const base = slugify(manifest.name) || manifest.id
  const { data: existing } = await supabase
    .from('installs')
    .select('slug')
    .eq('owner_id', user.id)
    .like('slug', `${base}%`)

  const taken = new Set((existing ?? []).map((row) => row.slug))
  let slug = base
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

  const { error } = await supabase.from('installs').insert({
    owner_id: user.id,
    module_id: manifest.id,
    module_version: manifest.version,
    slug,
    name: manifest.name,
    config: defaults,
    // The permissions the manifest declared are the permissions granted —
    // recorded on the install so a later manifest version cannot widen them
    // silently.
    granted_permissions: manifest.permissions,
    public_read_collections: publicReadCollections(manifest),
    public_write_collections: publicWriteCollections(manifest),
    public_enabled: false,
  })

  if (error) {
    return { error: 'Could not install that app. Please try again.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/store')
  return { ok: true }
}

export async function uninstallModule(installId: string): Promise<ActionState> {
  const { supabase, install } = await requireOwnedInstall(installId)

  const { error } = await supabase.from('installs').delete().eq('id', install.id)

  if (error) {
    return { error: 'Could not remove that app.' }
  }

  revalidatePath('/dashboard')
  return { ok: true }
}

export async function renameInstall(installId: string, name: string): Promise<ActionState> {
  const trimmed = name.trim()

  if (trimmed.length < 1 || trimmed.length > 80) {
    return { error: 'Name must be between 1 and 80 characters.' }
  }

  const { supabase, install } = await requireOwnedInstall(installId)
  const { error } = await supabase.from('installs').update({ name: trimmed }).eq('id', install.id)

  if (error) {
    return { error: 'Could not rename that app.' }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/apps/${install.id}`)
  return { ok: true }
}

export async function setInstallPublic(installId: string, isPublic: boolean): Promise<ActionState> {
  const { supabase, install, manifest } = await requireOwnedInstall(installId)

  if (isPublic && !manifest.publicSurface) {
    return { error: 'This app has no public page — it runs behind the scenes only.' }
  }

  const { error } = await supabase
    .from('installs')
    .update({ public_enabled: isPublic })
    .eq('id', install.id)

  if (error) {
    return { error: 'Could not update visibility.' }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/apps/${install.id}`)
  revalidatePath('/dashboard/design')
  return { ok: true }
}

export async function setAcceptingSubmissions(
  installId: string,
  accepting: boolean,
): Promise<ActionState> {
  const { supabase, install } = await requireOwnedInstall(installId)

  const { error } = await supabase
    .from('installs')
    .update({ accepting_submissions: accepting })
    .eq('id', install.id)

  if (error) {
    return { error: 'Could not update that setting.' }
  }

  revalidatePath(`/dashboard/apps/${install.id}`)
  return { ok: true }
}

export async function saveSettings(
  installId: string,
  input: Record<string, unknown>,
): Promise<ActionState> {
  const { supabase, install, manifest } = await requireOwnedInstall(installId)

  if (manifest.settings.length === 0) {
    return { ok: true }
  }

  const result = validateFields(manifest.settings, input)

  if (!result.ok) {
    return { error: Object.values(result.errors)[0] }
  }

  const { error } = await supabase
    .from('installs')
    .update({ config: result.data })
    .eq('id', install.id)

  if (error) {
    return { error: 'Could not save settings.' }
  }

  revalidatePath(`/dashboard/apps/${install.id}`)
  return { ok: true }
}

export async function createRecord(
  installId: string,
  collectionKey: string,
  input: Record<string, unknown>,
): Promise<ActionState> {
  const { supabase, install, manifest } = await requireOwnedInstall(installId)
  const collection = manifest.collections[collectionKey]

  if (!collection) {
    return { error: 'Unknown collection.' }
  }

  const result = validateOwnerRecord(collection, input)

  if (!result.ok) {
    return { error: Object.values(result.errors)[0] }
  }

  const { count } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('install_id', install.id)
    .eq('collection', collectionKey)

  const { error } = await supabase.from('records').insert({
    install_id: install.id,
    owner_id: install.owner_id,
    collection: collectionKey,
    data: result.data,
    position: count ?? 0,
  })

  if (error) {
    return { error: 'Could not save that entry.' }
  }

  revalidatePath(`/dashboard/apps/${install.id}`)
  return { ok: true }
}

export async function updateRecord(
  installId: string,
  collectionKey: string,
  recordId: string,
  input: Record<string, unknown>,
): Promise<ActionState> {
  const { supabase, install, manifest } = await requireOwnedInstall(installId)
  const collection = manifest.collections[collectionKey]

  if (!collection) {
    return { error: 'Unknown collection.' }
  }

  const result = validateOwnerRecord(collection, input)

  if (!result.ok) {
    return { error: Object.values(result.errors)[0] }
  }

  const { error } = await supabase
    .from('records')
    .update({ data: result.data })
    .eq('id', recordId)
    .eq('install_id', install.id)
    .eq('collection', collectionKey)

  if (error) {
    return { error: 'Could not update that entry.' }
  }

  revalidatePath(`/dashboard/apps/${install.id}`)
  return { ok: true }
}

export async function deleteRecord(installId: string, recordId: string): Promise<ActionState> {
  const { supabase, install } = await requireOwnedInstall(installId)

  const { error } = await supabase
    .from('records')
    .delete()
    .eq('id', recordId)
    .eq('install_id', install.id)

  if (error) {
    return { error: 'Could not delete that entry.' }
  }

  revalidatePath(`/dashboard/apps/${install.id}`)
  return { ok: true }
}

/** Swaps a record with its neighbour so owners can order what visitors see. */
export async function moveRecord(
  installId: string,
  collectionKey: string,
  recordId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  const { supabase, install } = await requireOwnedInstall(installId)

  const { data: rows } = await supabase
    .from('records')
    .select('id, position')
    .eq('install_id', install.id)
    .eq('collection', collectionKey)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (!rows) {
    return { error: 'Could not reorder that entry.' }
  }

  const index = rows.findIndex((row) => row.id === recordId)
  const target = direction === 'up' ? index - 1 : index + 1

  if (index === -1 || target < 0 || target >= rows.length) {
    return { ok: true }
  }

  // Positions are rewritten from the sorted order, which also repairs any
  // duplicate or gapped positions left behind by deletions.
  const reordered = [...rows]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved)

  for (const [position, row] of reordered.entries()) {
    if (row.position === position) {
      continue
    }

    await supabase.from('records').update({ position }).eq('id', row.id)
  }

  revalidatePath(`/dashboard/apps/${install.id}`)
  return { ok: true }
}

export async function saveProfile(input: {
  handle: string
  display_name: string
  tagline: string
  bio: string
  accent: string
  avatar_url: string
}): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  const handle = input.handle.trim().toLowerCase()

  if (!/^[a-z0-9][a-z0-9_-]{1,30}$/.test(handle)) {
    return {
      error: 'Handle must be 2–31 characters: lowercase letters, numbers, dashes or underscores.',
    }
  }

  if (input.display_name.length > 80) {
    return { error: 'Display name must be 80 characters or fewer.' }
  }

  if (input.bio.length > 400) {
    return { error: 'Bio must be 400 characters or fewer.' }
  }

  if (input.tagline.length > 120) {
    return { error: 'Tagline must be 120 characters or fewer.' }
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(input.accent)) {
    return { error: 'Pick a valid accent colour.' }
  }

  // An avatar is optional, but if given it must be an ordinary http(s) image link.
  const avatar = input.avatar_url.trim()

  if (avatar) {
    try {
      const parsed = new URL(avatar)

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('bad protocol')
      }
    } catch {
      return { error: 'The photo link must be a valid http or https URL.' }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      handle,
      display_name: input.display_name.trim(),
      tagline: input.tagline.trim(),
      bio: input.bio.trim(),
      accent: input.accent,
      avatar_url: avatar || null,
    })
    .eq('id', user.id)

  if (error) {
    return {
      error:
        error.code === '23505' ? 'That handle is already taken.' : 'Could not save your page.',
    }
  }

  revalidatePath('/dashboard/design')
  return { ok: true }
}

export async function setPagePublished(published: boolean): Promise<ActionState> {
  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('profiles')
    .update({ page_published: published })
    .eq('id', user.id)

  if (error) {
    return { error: 'Could not update your page.' }
  }

  revalidatePath('/dashboard/design')
  return { ok: true }
}

export async function signOut() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  redirect('/login')
}
