import { z } from 'zod'
import { fieldTypeSchema, moduleCategorySchema, publicTemplateSchema } from '@/lib/modules/spec'

/**
 * What the model is allowed to produce.
 *
 * This is deliberately much narrower than a full manifest: no ids, no keys, no
 * permissions, no derived flags — just the same handful of choices a person
 * makes in the manual builder (name, fields, whether there's a public face).
 * Everything else is computed afterward by the same code path a human's clicks
 * go through.
 *
 * The model's output is never trusted directly. It is parsed against this
 * schema first, then converted to a ModuleDraft and passed through the exact
 * manifest validation every other module goes through before it can be saved.
 */
export const aiFieldSchema = z.object({
  label: z.string().min(1).max(80),
  type: fieldTypeSchema,
  required: z.boolean(),
  ownerOnly: z.boolean(),
  help: z.string().max(200).optional(),
  /** Choice labels, for a "select" field. Values are derived from these. */
  options: z.array(z.string().min(1).max(60)).max(20).optional(),
})

export type AiField = z.infer<typeof aiFieldSchema>

export const aiDraftSchema = z.object({
  name: z.string().min(1).max(48),
  tagline: z.string().min(1).max(90),
  description: z.string().min(1).max(600),
  icon: z.string().min(1).max(8),
  category: moduleCategorySchema,
  /** A hex colour, or omitted to keep the author's own accent. */
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  collectionLabel: z.string().min(1).max(60),
  collectionLabelSingular: z.string().min(1).max(60),
  fields: z.array(aiFieldSchema).min(1).max(20),
  /** Must name one of the "select" fields above, to group entries by it. */
  groupByFieldLabel: z.string().max(80).optional(),
  sortable: z.boolean(),
  hasPublicPage: z.boolean(),
  publicTemplate: publicTemplateSchema.optional(),
  publicHeading: z.string().max(80).optional(),
})

export type AiDraft = z.infer<typeof aiDraftSchema>
