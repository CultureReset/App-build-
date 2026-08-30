import { keyFrom } from '@/lib/modules/field-key'
import { TEMPLATE_VARIANTS, type ModuleField } from '@/lib/modules/spec'
import type { ModuleDraft } from '@/lib/modules/derive'
import type { AiDraft } from '@/lib/ai/draft-schema'

/**
 * Converts a model's proposal into the same draft shape the manual builder
 * edits. This is pure data transformation — field keys are derived exactly as
 * the manual field editor derives them, and the result is still run through
 * `validateDraft` before it can ever be saved, same as everything a person
 * types by hand.
 */
export function aiDraftToModuleDraft(
  ai: AiDraft,
  context: { accent: string; author: { name: string; handle: string } },
): ModuleDraft {
  const taken: string[] = []
  const fields: ModuleField[] = ai.fields.map((field) => {
    const key = keyFrom(field.label, taken)
    taken.push(key)

    const base: ModuleField = {
      key,
      label: field.label,
      type: field.type,
      required: field.required,
      ownerOnly: field.ownerOnly,
      help: field.help,
      maxLength: field.type === 'longtext' ? 2000 : field.type === 'text' ? 200 : undefined,
    }

    if (field.type === 'select' && field.options?.length) {
      const optionKeys: string[] = []
      base.options = field.options.map((label) => {
        const value = keyFrom(label, optionKeys)
        optionKeys.push(value)
        return { value, label }
      })
    }

    return base
  })

  // A select field with no options is not renderable; fall back to text so
  // the draft still validates rather than silently dropping the field.
  const usableFields = fields.map((field) =>
    field.type === 'select' && !field.options?.length ? { ...field, type: 'text' as const } : field,
  )

  const groupField = ai.groupByFieldLabel
    ? usableFields.find(
        (field) =>
          field.type === 'select' &&
          field.label.toLowerCase() === ai.groupByFieldLabel!.toLowerCase(),
      )?.key
    : undefined

  const collectionKey = 'items'

  const hasSurface = ai.hasPublicPage && ai.publicTemplate
  const template = ai.publicTemplate

  return {
    id: 'preview',
    version: '1.0.0',
    name: ai.name,
    tagline: ai.tagline,
    description: ai.description,
    icon: ai.icon,
    accent: ai.accent ?? context.accent,
    category: ai.category,
    author: context.author,
    pricing: { model: 'free', amountCents: 0 },
    settings: [],
    collections: {
      [collectionKey]: {
        label: ai.collectionLabel,
        labelSingular: ai.collectionLabelSingular,
        titleField: usableFields[0].key,
        groupField,
        sortable: ai.sortable,
        fields: usableFields,
      },
    },
    publicSurface: hasSurface
      ? {
          template: template!,
          collection: collectionKey,
          submitCollection: template === 'form' ? collectionKey : undefined,
          heading: ai.publicHeading,
          defaultVariant: TEMPLATE_VARIANTS[template!][0],
        }
      : undefined,
  }
}
