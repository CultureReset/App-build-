'use server'

import { headers } from 'next/headers'
import { generateAppDraft } from '@/lib/ai/generate'
import { resolveModel } from '@/lib/ai/resolve-model'
import { platformDefaultConfig } from '@/lib/ai/resolve-config'
import { aiDraftToModuleDraft } from '@/lib/ai/map-draft'
import { validateDraft } from '@/lib/modules/derive'
import { draftContext } from '@/lib/engine/drafts'
import { createHourlyLimiter, maxClientsFromEnv } from '@/lib/ai/builder-limit'
import { gateConfig, resolveOperator } from '@/lib/paperclip-session'
import type { AiDraft } from '@/lib/ai/draft-schema'
import type { ProposeState } from '@/app/dashboard/build/ai-actions'

/**
 * Describe-it / speak-it for the store-mode builder (/build/describe).
 *
 * Same generation and the same two checks as the retired dashboard's
 * proposeApp (ai-actions.ts there): the model's output is parsed against
 * AiDraft, mapped to a builder draft and run through validateDraft. What
 * differs is who pays and who is limited, since there is no App-build- login
 * any more: only the deployment's own provider (platform env) is used, the
 * caller must hold a Paperclip instance-admin session (the same gate as
 * src/proxy.ts, DECISIONS #50), and only when BUILDER_AI_HOURLY_LIMIT is a
 * positive number, which caps calls per operator per hour on this server
 * instance, holding at most BUILDER_AI_MAX_CLIENTS operators
 * (lib/ai/builder-limit.ts). The limit is keyed on the Paperclip user id,
 * never on a forwarded address (closes DECISIONS #18).
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
  const operator = await resolveOperator({ cookie: list.get('cookie'), config: gateConfig() })
  if (!operator?.isInstanceAdmin) {
    return { ok: false, error: 'App generation is for Paperclip instance admins. Sign in to Paperclip first.' }
  }
  if (!limiter.allow(operator.userId)) {
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
