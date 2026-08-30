import { generateObject, NoObjectGeneratedError, type LanguageModel } from 'ai'
import { aiDraftSchema, type AiDraft } from '@/lib/ai/draft-schema'

const MAX_PROMPT_LENGTH = 2000

const SYSTEM_PROMPT = `You turn a plain-language request into a definition for a small app on a
no-code platform. You are not writing code — you are choosing, from a fixed
set of building blocks, what the app stores and how it looks. Respond with
exactly the structured object requested.

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
 * Takes an already-resolved `LanguageModel` rather than owning any provider
 * itself — the same call works identically whether that model was built from
 * Anthropic, OpenAI, Google, OpenRouter, or a self-hosted endpoint. The schema
 * that constrains the model's output is the same `aiDraftSchema` the rest of
 * the platform validates against — generateObject builds the provider-specific
 * request from it and validates the response against it, so there is no
 * hand-maintained copy of the schema to drift out of sync.
 *
 * The model's output is still not trusted just because it parsed: the caller
 * runs the result through full manifest validation before anything is saved.
 * This function only ever returns a schema-shaped draft or a message — never
 * throws into calling code.
 */
export async function generateAppDraft(input: {
  model: LanguageModel
  prompt: string
  previous?: AiDraft
}): Promise<GenerateResult> {
  const prompt = input.prompt.trim().slice(0, MAX_PROMPT_LENGTH)

  if (prompt.length < 3) {
    return { error: 'Describe the app in a bit more detail.' }
  }

  const userPrompt = input.previous
    ? `The app currently looks like this:\n${JSON.stringify(input.previous)}\n\nApply this change: ${prompt}`
    : `Build an app for: ${prompt}`

  try {
    const { object } = await generateObject({
      model: input.model,
      schema: aiDraftSchema,
      schemaName: 'propose_app',
      schemaDescription: 'A definition for a small business app.',
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    })

    return { draft: object }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { error: 'Did not get back a usable app definition. Try rephrasing.' }
    }

    return {
      error: 'Could not reach the app generator. Check your provider settings and try again.',
    }
  }
}
