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

/**
 * The tool schema handed to the model, generated from the same zod enums the
 * rest of the platform validates against — so the set of field types and
 * templates the model can choose from can never drift from what actually
 * exists.
 */
export const PROPOSE_APP_TOOL = {
  name: 'propose_app',
  description: 'Propose a definition for a small business app based on the request.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Short app name, 2-6 words.' },
      tagline: { type: 'string', description: 'One sentence, under 90 characters.' },
      description: { type: 'string', description: 'Two or three sentences on what it is for.' },
      icon: { type: 'string', description: 'A single emoji that represents the app.' },
      category: { type: 'string', enum: moduleCategorySchema.options },
      accent: {
        type: 'string',
        description: 'Optional hex colour like #4d4de5. Omit to use the author’s own colour.',
      },
      collectionLabel: {
        type: 'string',
        description: 'Plural name for the entries this app stores, e.g. "Bookings".',
      },
      collectionLabelSingular: { type: 'string', description: 'Singular form, e.g. "Booking".' },
      fields: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            type: { type: 'string', enum: fieldTypeSchema.options },
            required: { type: 'boolean' },
            ownerOnly: {
              type: 'boolean',
              description:
                'True only for a field the business sets themselves, like a status — never for something a visitor fills in.',
            },
            help: { type: 'string', description: 'Optional short helper text.' },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Choice labels. Required when type is "select", omitted otherwise.',
            },
          },
          required: ['label', 'type', 'required', 'ownerOnly'],
        },
      },
      groupByFieldLabel: {
        type: 'string',
        description: 'The label of a "select" field above to group entries by, if any.',
      },
      sortable: {
        type: 'boolean',
        description: 'Whether the owner should be able to drag entries into their own order.',
      },
      hasPublicPage: {
        type: 'boolean',
        description: 'Whether this app has anything visitors should see on the owner’s public page.',
      },
      publicTemplate: {
        type: 'string',
        enum: publicTemplateSchema.options,
        description: 'Required when hasPublicPage is true. Omit entirely otherwise.',
      },
      publicHeading: { type: 'string', description: 'Heading shown above the block on the page.' },
    },
    required: [
      'name',
      'tagline',
      'description',
      'icon',
      'category',
      'collectionLabel',
      'collectionLabelSingular',
      'fields',
      'sortable',
      'hasPublicPage',
    ],
  },
}
