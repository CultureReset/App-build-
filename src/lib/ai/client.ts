import Anthropic from '@anthropic-ai/sdk'
import { PROPOSE_APP_TOOL, aiDraftSchema, type AiDraft } from '@/lib/ai/draft-schema'

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
const MAX_PROMPT_LENGTH = 2000

const SYSTEM_PROMPT = `You turn a plain-language request into a definition for a small app on a
no-code platform. You are not writing code — you are choosing, from a fixed
set of building blocks, what the app stores and how it looks. Call the
propose_app tool exactly once with your answer.

Guidance:
- Keep it to one collection of entries with a handful of well-chosen fields.
  Prefer fewer, clearer fields over many overlapping ones.
- Mark a field "ownerOnly" only when it is something the business sets, like a
  status or an internal note — never for something a customer or visitor would
  fill in themselves.
- Set hasPublicPage to true only when the request implies something a visitor
  should see or fill in (a menu, a form, a gallery, a list of listings). Pick
  the public template that matches: "form" for something visitors submit,
  "listings" for photo+price cards, "catalog" for a priced list, "gallery" for
  photos, "faq" for questions and answers, "links" or "actions" for simple
  link rows, "board" for a public feed, "socials" for profile links, "embed"
  for a single video.
- If the request is for something that runs privately for the business only
  (an internal log, a private tracker), set hasPublicPage to false and omit
  publicTemplate entirely.`

export type GenerateResult = { draft: AiDraft } | { error: string }

/**
 * Proposes an app definition from a description, optionally refining a prior
 * proposal with new instructions.
 *
 * The model's raw output is never trusted: it is parsed against aiDraftSchema
 * here, and the caller still runs the result through full manifest validation
 * before anything can be saved. This function only ever returns a schema-
 * shaped draft or a message — never throws into calling code.
 */
export async function generateAppDraft(input: {
  prompt: string
  previous?: AiDraft
}): Promise<GenerateResult> {
  if (!isAiConfigured()) {
    return { error: 'App generation is not configured on this deployment yet.' }
  }

  const prompt = input.prompt.trim().slice(0, MAX_PROMPT_LENGTH)

  if (prompt.length < 3) {
    return { error: 'Describe the app in a bit more detail.' }
  }

  const userContent = input.previous
    ? `The app currently looks like this:\n${JSON.stringify(input.previous)}\n\nApply this change: ${prompt}`
    : `Build an app for: ${prompt}`

  let response: Anthropic.Message

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [PROPOSE_APP_TOOL],
      tool_choice: { type: 'tool', name: 'propose_app' },
      messages: [{ role: 'user', content: userContent }],
    })
  } catch {
    return { error: 'Could not reach the app generator. Please try again.' }
  }

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )

  if (!call) {
    return { error: 'Did not get back a usable app definition. Try rephrasing.' }
  }

  const parsed = aiDraftSchema.safeParse(call.input)

  if (!parsed.success) {
    return { error: 'The generated app definition was not valid. Try rephrasing your request.' }
  }

  return { draft: parsed.data }
}
