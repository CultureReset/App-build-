import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiDraftSchema, PROPOSE_APP_TOOL } from '../src/lib/ai/draft-schema.ts'
import { aiDraftToModuleDraft } from '../src/lib/ai/map-draft.ts'
import { validateDraft } from '../src/lib/modules/derive.ts'

const CONTEXT = { accent: '#4d4de5', author: { name: 'Dana', handle: 'dana' } }

/**
 * The model's output is never trusted directly. These tests exercise the same
 * path a real generation goes through: schema-check the tool call, map it to
 * a ModuleDraft, and run it through the exact validation a hand-built app
 * passes through. No network call — the model is not involved here at all.
 */
test('a well-formed proposal produces a valid, installable manifest', () => {
  const parsed = aiDraftSchema.parse({
    name: 'Table Bookings',
    tagline: 'Take booking requests from your page.',
    description: 'Visitors request a table; you manage the queue from your dashboard.',
    icon: '🍽️',
    category: 'hospitality',
    collectionLabel: 'Bookings',
    collectionLabelSingular: 'Booking',
    fields: [
      { label: 'Name', type: 'text', required: true, ownerOnly: false },
      { label: 'Phone', type: 'phone', required: true, ownerOnly: false },
      { label: 'Party size', type: 'number', required: true, ownerOnly: false },
      {
        label: 'Status',
        type: 'select',
        required: false,
        ownerOnly: true,
        options: ['New', 'Confirmed', 'Seated'],
      },
    ],
    groupByFieldLabel: 'Status',
    sortable: false,
    hasPublicPage: true,
    publicTemplate: 'form',
    publicHeading: 'Book a table',
  })

  const draft = aiDraftToModuleDraft(parsed, CONTEXT)
  const result = validateDraft({ ...draft, id: 'dana-table-bookings' })

  assert.equal(result.success, true)
})

test('an owner-only field is never publicly writable, even when the model marks it required', () => {
  const parsed = aiDraftSchema.parse({
    name: 'Jobs',
    tagline: 'Track jobs.',
    description: 'A private list of jobs in progress.',
    icon: '🛠️',
    category: 'operations',
    collectionLabel: 'Jobs',
    collectionLabelSingular: 'Job',
    fields: [
      { label: 'Customer', type: 'text', required: true, ownerOnly: false },
      { label: 'Internal cost', type: 'money', required: true, ownerOnly: true },
    ],
    sortable: false,
    hasPublicPage: true,
    publicTemplate: 'form',
  })

  const draft = aiDraftToModuleDraft(parsed, CONTEXT)
  const manifest = validateDraft({ ...draft, id: 'dana-jobs' })

  assert.equal(manifest.success, true)
  if (manifest.success) {
    const field = manifest.data.collections.items.fields.find((f) => f.label === 'Internal cost')
    assert.equal(field?.ownerOnly, true)
  }
})

test('duplicate field labels still produce distinct, valid keys', () => {
  const parsed = aiDraftSchema.parse({
    name: 'Feedback',
    tagline: 'Collect feedback.',
    description: 'A simple feedback form.',
    icon: '📝',
    category: 'content',
    collectionLabel: 'Responses',
    collectionLabelSingular: 'Response',
    fields: [
      { label: 'Name', type: 'text', required: false, ownerOnly: false },
      { label: 'Name', type: 'text', required: false, ownerOnly: false },
    ],
    sortable: false,
    hasPublicPage: false,
  })

  const draft = aiDraftToModuleDraft(parsed, CONTEXT)
  const keys = draft.collections.items.fields.map((f) => f.key)

  assert.equal(new Set(keys).size, keys.length)
  assert.equal(validateDraft({ ...draft, id: 'dana-feedback' }).success, true)
})

test('a select field proposed with no options falls back to text rather than failing', () => {
  const parsed = aiDraftSchema.parse({
    name: 'Notes',
    tagline: 'Keep notes.',
    description: 'A private notes list.',
    icon: '🗒️',
    category: 'personal',
    collectionLabel: 'Notes',
    collectionLabelSingular: 'Note',
    fields: [{ label: 'Priority', type: 'select', required: false, ownerOnly: false }],
    sortable: false,
    hasPublicPage: false,
  })

  const draft = aiDraftToModuleDraft(parsed, CONTEXT)

  assert.equal(draft.collections.items.fields[0].type, 'text')
  assert.equal(validateDraft({ ...draft, id: 'dana-notes' }).success, true)
})

test('a headless app has no public surface regardless of template hints', () => {
  const parsed = aiDraftSchema.parse({
    name: 'Suppliers',
    tagline: 'Internal supplier list.',
    description: 'For the business only.',
    icon: '📇',
    category: 'operations',
    collectionLabel: 'Suppliers',
    collectionLabelSingular: 'Supplier',
    fields: [{ label: 'Name', type: 'text', required: true, ownerOnly: false }],
    sortable: false,
    hasPublicPage: false,
  })

  const draft = aiDraftToModuleDraft(parsed, CONTEXT)
  assert.equal(draft.publicSurface, undefined)
})

test('the model cannot propose a field type or template outside the real spec', () => {
  const invalidType = aiDraftSchema.safeParse({
    name: 'X',
    tagline: 'x',
    description: 'x',
    icon: '🧩',
    category: 'operations',
    collectionLabel: 'Items',
    collectionLabelSingular: 'Item',
    fields: [{ label: 'Weird', type: 'javascript', required: false, ownerOnly: false }],
    sortable: false,
    hasPublicPage: false,
  })

  assert.equal(invalidType.success, false)

  const invalidTemplate = aiDraftSchema.safeParse({
    name: 'X',
    tagline: 'x',
    description: 'x',
    icon: '🧩',
    category: 'operations',
    collectionLabel: 'Items',
    collectionLabelSingular: 'Item',
    fields: [{ label: 'Name', type: 'text', required: false, ownerOnly: false }],
    sortable: false,
    hasPublicPage: true,
    publicTemplate: 'iframe-anything',
  })

  assert.equal(invalidTemplate.success, false)
})

test('the tool schema only ever offers real field types and templates', async () => {
  const { fieldTypeSchema, publicTemplateSchema } = await import('../src/lib/modules/spec.ts')

  const props = PROPOSE_APP_TOOL.input_schema.properties as Record<string, { enum?: string[] }>
  const fieldTypeEnum = (
    props.fields as unknown as {
      items: { properties: { type: { enum: string[] } } }
    }
  ).items.properties.type.enum

  assert.deepEqual(fieldTypeEnum, fieldTypeSchema.options)
  assert.deepEqual(props.publicTemplate.enum, publicTemplateSchema.options)
})
