import type { ModuleDraft } from '@/lib/modules/derive'

/**
 * Starting drafts for the store-mode builder. The draft shape is the
 * builder's own (src/lib/modules/derive.ts); author and accent are required
 * by that shape but are not carried into the engine manifest, so they hold
 * neutral placeholders here.
 */
const PLACEHOLDER = { accent: '#4f46e5', author: { name: 'Store', handle: 'store' } }

/** The same blank app createModule() (dashboard/build/actions.ts) starts from. */
export function blankDraft(name: string): ModuleDraft {
  return {
    id: 'draft',
    version: '1.0.0',
    name,
    tagline: 'What this app does, in one line.',
    description: 'A longer description of what this app is for and who it helps.',
    icon: '🧩',
    accent: PLACEHOLDER.accent,
    category: 'operations',
    author: PLACEHOLDER.author,
    pricing: { model: 'free', amountCents: 0 },
    settings: [],
    collections: {
      items: {
        label: 'Entries',
        labelSingular: 'Entry',
        titleField: 'title',
        sortable: true,
        fields: [{ key: 'title', label: 'Title', type: 'text', required: true, maxLength: 120, ownerOnly: false }],
      },
    },
  }
}

// The shipped apps as drafts: starterDrafts() in ./starters.ts (server-side,
// it reads apps/*/manifest.json — one definition per app, DECISIONS #42).

/** A describe-it proposal needs an accent and author too; the same placeholders. */
export const draftContext = PLACEHOLDER
