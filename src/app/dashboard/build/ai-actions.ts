'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { generateAppDraft, isAiConfigured } from '@/lib/ai/client'
import { aiDraftToModuleDraft } from '@/lib/ai/map-draft'
import { validateDraft, type ModuleDraft } from '@/lib/modules/derive'
import type { AiDraft } from '@/lib/ai/draft-schema'
import type { ProfileRow } from '@/lib/supabase/types'

export type ProposeState =
  | { ok: true; draft: AiDraft; preview: ModuleDraft }
  | { ok: false; error: string }

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

export async function aiGenerationAvailable(): Promise<boolean> {
  return isAiConfigured()
}

/**
 * Proposes or refines an app from a description.
 *
 * Every layer here is checked independently: the rate limit is enforced in the
 * database (so it holds regardless of what calls this action), the model's
 * output is parsed against a fixed schema, and the resulting draft still has
 * to pass the same manifest validation a hand-built app does. Nothing is saved
 * by this call — it only returns a preview.
 */
export async function proposeApp(input: {
  prompt: string
  previous?: AiDraft
}): Promise<ProposeState> {
  const { supabase, user } = await requireUser()

  const { error: limitError } = await supabase.rpc('check_and_log_ai_generation')

  if (limitError) {
    return {
      ok: false,
      error: limitError.message.includes('rate_limited')
        ? 'You have generated a few apps already — try again in a little while.'
        : 'Could not start app generation.',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (!profile) {
    return { ok: false, error: 'Could not read your account.' }
  }

  const result = await generateAppDraft({ prompt: input.prompt, previous: input.previous })

  if ('error' in result) {
    return { ok: false, error: result.error }
  }

  const preview = aiDraftToModuleDraft(result.draft, {
    accent: profile.accent,
    author: { name: profile.display_name || `@${profile.handle}`, handle: profile.handle },
  })

  const validation = validateDraft(preview)

  if (!validation.success) {
    // The model produced something structurally valid but not usable as a
    // manifest (e.g. a stray field reference). Surface it rather than saving.
    return {
      ok: false,
      error: `Generated app was not quite right: ${validation.error.issues[0]?.message ?? 'invalid definition'}. Try rephrasing.`,
    }
  }

  return { ok: true, draft: result.draft, preview }
}

/**
 * Creates a module from an accepted AI proposal.
 *
 * The proposal is regenerated into a full draft and validated again here — it
 * is never trusted just because a preview once succeeded — and the module
 * lands as a private draft in the same builder a hand-built app uses.
 */
export async function createModuleFromAiDraft(aiDraft: AiDraft): Promise<{
  ok: boolean
  error?: string
  id?: string
}> {
  const { supabase, user } = await requireUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (!profile) {
    return { ok: false, error: 'Could not read your account.' }
  }

  const draft = aiDraftToModuleDraft(aiDraft, {
    accent: profile.accent,
    author: { name: profile.display_name || `@${profile.handle}`, handle: profile.handle },
  })

  const base = `${slugify(profile.handle)}-${slugify(draft.name) || 'app'}`.slice(0, 40)

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

  const validation = validateDraft({ ...draft, id: moduleId })

  if (!validation.success) {
    return { ok: false, error: 'That app definition is not valid.' }
  }

  const { data, error } = await supabase
    .from('module_listings')
    .insert({
      module_id: moduleId,
      version: '1.0.0',
      author_id: user.id,
      manifest: validation.data,
      price_cents: 0,
      pricing_model: 'free',
      status: 'draft',
      visibility: 'private',
      is_builtin: false,
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error || !data) {
    return { ok: false, error: 'Could not create that app.' }
  }

  revalidatePath('/dashboard/build')
  return { ok: true, id: data.id }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}
