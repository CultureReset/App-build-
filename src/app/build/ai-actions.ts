'use server'

import { headers } from 'next/headers'
import { generateAppDraft } from '@/lib/ai/generate'
import { resolveModel } from '@/lib/ai/resolve-model'
import { platformDefaultConfig } from '@/lib/ai/resolve-config'
import { aiDraftToModuleDraft } from '@/lib/ai/map-draft'
import { validateDraft } from '@/lib/modules/derive'
import { draftContext } from '@/lib/engine/drafts'
import { createHourlyLimiter, maxClientsFromEnv } from '@/lib/ai/builder-limit'
import type { AiDraft } from '@/lib/ai/draft-schema'
import type { ProposeState } from '@/app/dashboard/build/ai-actions'

/**
 * Describe-it / speak-it for the store-mode builder (/build/describe).
 *
 * Same generation and the same two checks as the retired dashboard's
 * proposeApp (ai-actions.ts there): the model's output is parsed against
 * AiDraft, mapped to a builder draft and run through validateDraft. What
 * differs is who pays and who is limited, since there is no App-build- login
 * any more: only the deployment's own provider (platform env) is used, and
 * only when BUILDER_AI_HOURLY_LIMIT is a positive number, which caps calls
 * per client address per hour on this server instance, holding at most
 * BUILDER_AI_MAX_CLIENTS addresses (lib/ai/builder-limit.ts). Deploy it where
 * only people who should build apps can reach it (e.g. behind Plat-admin).
 *
 * The client address is the first x-forwarded-for entry, which is only as
 * trustworthy as the proxy in front of this server: a Next server action has
 * no view of the connection itself. Whether this builder should instead
 * require a login is an owner decision, not made here.
 */

function hourlyLimit(): number {
  const n = Number(process.env.BUILDER_AI_HOURLY_LIMIT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

const limiter = createHourlyLimiter({ limit: hourlyLimit, maxKeys: maxClientsFromEnv() })

export async function storeAiAvailable(): Promise<boolean> {
  return hourlyLimit() > 0 && platformDefaultConfig() !== null
}

export async function proposeStoreApp(input: { prompt: string; previous?: AiDraft }): Promise<ProposeState> {
  const config = platformDefaultConfig()
  if (!config || hourlyLimit() === 0) {
    return { ok: false, error: 'App generation is not set up on this deployment.' }
  }

  const list = await headers()
  const client = (list.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!limiter.allow(client)) {
    return { ok: false, error: 'You have generated a few apps already — try again in a little while.' }
  }

  let model
  try {
    model = resolveModel(config)
  } catch {
    return { ok: false, error: 'The AI provider is not fully configured.' }
  }

  const result = await generateAppDraft({ model, prompt: input.prompt, previous: input.previous })
  if ('error' in result) return { ok: false, error: result.error }

  const preview = aiDraftToModuleDraft(result.draft, draftContext)
  const validation = validateDraft(preview)
  if (!validation.success) {
    return {
      ok: false,
      error: `Generated app was not quite right: ${validation.error.issues[0]?.message ?? 'invalid definition'}. Try rephrasing.`,
    }
  }

  return { ok: true, draft: result.draft, preview }
}
