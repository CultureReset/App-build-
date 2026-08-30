'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { validateDraft, nextVersion, type ModuleDraft } from '@/lib/modules/derive'
import { loadListing, type ModuleListingRow } from '@/lib/modules/catalogue'
import type { ProfileRow } from '@/lib/supabase/types'

export type ActionState = { error?: string; ok?: boolean; id?: string }

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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

/**
 * Creates a new module owned by the caller.
 *
 * Module ids are namespaced with the author's handle so one author can never
 * take an id another author is using, and so a built-in id can never be
 * shadowed by a user module.
 */
export async function createModule(name: string): Promise<ActionState> {
  const trimmed = name.trim()

  if (trimmed.length < 2 || trimmed.length > 48) {
    return { error: 'Give your app a name between 2 and 48 characters.' }
  }

  const { supabase, user } = await requireUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (!profile) {
    return { error: 'Could not read your account.' }
  }

  const base = `${slugify(profile.handle)}-${slugify(trimmed) || 'app'}`.slice(0, 40)

  const { data: taken } = await supabase
    .from('module_listings')
    .select('module_id')
    .like('module_id', `${base}%`)

  const used = new Set((taken ?? []).map((row) => row.module_id))
  let moduleId = base
  let counter = 2

  while (used.has(moduleId)) {
    moduleId = `${base}-${counter}`.slice(0, 40)
    counter += 1
  }

  const draft: ModuleDraft = {
    id: moduleId,
    version: '1.0.0',
    name: trimmed,
    tagline: 'What this app does, in one line.',
    description: 'A longer description of what this app is for and who it helps.',
    icon: '🧩',
    accent: profile.accent,
    category: 'operations',
    author: { name: profile.display_name || `@${profile.handle}`, handle: profile.handle },
    pricing: { model: 'free', amountCents: 0 },
    settings: [],
    collections: {
      items: {
        label: 'Entries',
        labelSingular: 'Entry',
        titleField: 'title',
        sortable: true,
        fields: [
          {
            key: 'title',
            label: 'Title',
            type: 'text',
            required: true,
            maxLength: 120,
            ownerOnly: false,
          },
        ],
      },
    },
  }

  const result = validateDraft(draft)

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Could not create that app.' }
  }

  const { data, error } = await supabase
    .from('module_listings')
    .insert({
      module_id: moduleId,
      version: '1.0.0',
      author_id: user.id,
      manifest: result.data,
      price_cents: 0,
      pricing_model: 'free',
      status: 'draft',
      visibility: 'private',
      is_builtin: false,
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error || !data) {
    return { error: 'Could not create that app.' }
  }

  revalidatePath('/dashboard/build')
  return { ok: true, id: data.id }
}

async function requireOwnedListing(listingId: string) {
  const { supabase, user } = await requireUser()

  const { data } = await supabase
    .from('module_listings')
    .select('*')
    .eq('id', listingId)
    .eq('author_id', user.id)
    .maybeSingle<ModuleListingRow>()

  if (!data) {
    return { supabase, user, listing: null }
  }

  return { supabase, user, listing: data }
}

/**
 * Saves an edited draft.
 *
 * The manifest is validated through the same gate every module passes, so a
 * broken definition can never reach the store or anybody's dashboard.
 */
export async function saveModule(listingId: string, draft: ModuleDraft): Promise<ActionState> {
  const { supabase, listing } = await requireOwnedListing(listingId)

  if (!listing) {
    return { error: 'That app was not found on your account.' }
  }

  // The id and the author are the module's identity; the editor cannot move it.
  const result = validateDraft({
    ...draft,
    id: listing.module_id,
    author: draft.author,
  })

  if (!result.success) {
    const issue = result.error.issues[0]
    return { error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'That app is not valid.' }
  }

  const { error } = await supabase
    .from('module_listings')
    .update({
      manifest: result.data,
      version: result.data.version,
      price_cents: result.data.pricing.amountCents,
      pricing_model: result.data.pricing.model,
    })
    .eq('id', listing.id)

  if (error) {
    return { error: 'Could not save that app.' }
  }

  revalidatePath('/dashboard/build')
  revalidatePath(`/dashboard/build/${listing.id}`)
  return { ok: true }
}

/**
 * Publishes a module.
 *
 * Existing installs are untouched: they run on the manifest they pinned at
 * install time, so publishing is never a way to change somebody else's app.
 */
export async function setModuleVisibility(
  listingId: string,
  visibility: 'private' | 'unlisted' | 'public',
): Promise<ActionState> {
  const { supabase, listing } = await requireOwnedListing(listingId)

  if (!listing) {
    return { error: 'That app was not found on your account.' }
  }

  const entry = await loadListing(supabase, listing.id)

  if (!entry) {
    return { error: 'This app is not valid yet, so it cannot be shared.' }
  }

  const { error } = await supabase
    .from('module_listings')
    .update({
      visibility,
      status: visibility === 'private' ? 'draft' : 'published',
    })
    .eq('id', listing.id)

  if (error) {
    return { error: 'Could not change who can see this app.' }
  }

  revalidatePath('/dashboard/build')
  revalidatePath('/dashboard/store')
  revalidatePath(`/dashboard/build/${listing.id}`)
  return { ok: true }
}

/**
 * Starts a new version of a published module.
 *
 * A published version is frozen so that what people installed stays what they
 * installed. Changing it means creating the next version, which people choose
 * to move to.
 */
export async function createVersion(listingId: string): Promise<ActionState> {
  const { supabase, user, listing } = await requireOwnedListing(listingId)

  if (!listing) {
    return { error: 'That app was not found on your account.' }
  }

  const entry = await loadListing(supabase, listing.id)

  if (!entry) {
    return { error: 'That app could not be read.' }
  }

  const { data: siblings } = await supabase
    .from('module_listings')
    .select('version')
    .eq('module_id', listing.module_id)

  const versions = new Set((siblings ?? []).map((row) => row.version))
  let version = nextVersion(entry.manifest.version, 'minor')

  while (versions.has(version)) {
    version = nextVersion(version, 'minor')
  }

  const { data, error } = await supabase
    .from('module_listings')
    .insert({
      module_id: listing.module_id,
      version,
      author_id: user.id,
      manifest: { ...entry.manifest, version },
      price_cents: listing.price_cents,
      pricing_model: listing.pricing_model,
      status: 'draft',
      visibility: 'private',
      is_builtin: false,
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error || !data) {
    return { error: 'Could not start a new version.' }
  }

  revalidatePath('/dashboard/build')
  return { ok: true, id: data.id }
}

export async function deleteModule(listingId: string): Promise<ActionState> {
  const { supabase, listing } = await requireOwnedListing(listingId)

  if (!listing) {
    return { error: 'That app was not found on your account.' }
  }

  const { error } = await supabase.from('module_listings').delete().eq('id', listing.id)

  if (error) {
    return { error: 'Could not delete that app.' }
  }

  revalidatePath('/dashboard/build')
  return { ok: true }
}
