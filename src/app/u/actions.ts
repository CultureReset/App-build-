'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase/server'
import { getModule } from '@/lib/modules/registry'
import { validatePublicRecord } from '@/lib/runtime/values'

export type SubmitState = { error?: string; ok?: boolean }

/**
 * Derives a stable, non-reversible fingerprint for an anonymous visitor.
 *
 * We never store a raw IP address. The hash is salted per install so the same
 * visitor cannot be correlated across two different owners' pages.
 */
async function clientHash(installId: string): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || headerList.get('x-real-ip') || 'unknown'
  const agent = headerList.get('user-agent') ?? 'unknown'

  return createHash('sha256').update(`${installId}:${ip}:${agent}`).digest('hex')
}

const ERROR_COPY: Record<string, string> = {
  closed: 'This form is not accepting entries right now.',
  rate_limited: 'You have sent a few already — give it a moment before sending another.',
  forbidden_collection: 'This form is not accepting entries right now.',
  invalid_payload: 'That submission could not be read. Please try again.',
  payload_too_large: 'That submission is too long.',
  not_found: 'This form no longer exists.',
}

/**
 * The only write path available to an anonymous visitor.
 *
 * Note what this does *not* do: it never trusts the module id, the collection
 * name, or the owner from the request. It re-reads the install, re-validates
 * against the manifest, strips owner-only fields, and then hands off to a
 * database function that independently re-checks permission and rate limits.
 */
export async function submitPublicRecord(
  installId: string,
  input: Record<string, unknown>,
): Promise<SubmitState> {
  const supabase = await createServerSupabase()

  // RLS only returns this row if the install is genuinely live and published.
  const { data: install } = await supabase
    .from('installs')
    .select('id, module_id, accepting_submissions, public_write_collections')
    .eq('id', installId)
    .maybeSingle()

  if (!install) {
    return { error: ERROR_COPY.not_found }
  }

  if (!install.accepting_submissions) {
    return { error: ERROR_COPY.closed }
  }

  const manifest = getModule(install.module_id)
  const surface = manifest?.publicSurface

  if (!manifest || !surface?.submitCollection) {
    return { error: ERROR_COPY.closed }
  }

  const collectionKey = surface.submitCollection

  if (!install.public_write_collections.includes(collectionKey)) {
    return { error: ERROR_COPY.forbidden_collection }
  }

  const collection = manifest.collections[collectionKey]

  if (!collection) {
    return { error: ERROR_COPY.closed }
  }

  const result = validatePublicRecord(collection, input)

  if (!result.ok) {
    return { error: Object.values(result.errors)[0] }
  }

  const { error } = await supabase.rpc('submit_public_record', {
    p_install_id: installId,
    p_collection: collectionKey,
    p_payload: result.data,
    p_client_hash: await clientHash(installId),
  })

  if (error) {
    const key = Object.keys(ERROR_COPY).find((code) => error.message.includes(code))
    return { error: key ? ERROR_COPY[key] : 'Could not send that. Please try again.' }
  }

  revalidatePath(`/dashboard/apps/${installId}`)
  return { ok: true }
}
