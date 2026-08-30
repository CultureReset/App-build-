import type { DisplayVariant, PublicTemplate } from '@/lib/modules/spec'

/**
 * Describes every public template as data, so the app builder can offer them
 * without knowing anything about the components that render them.
 *
 * Adding a template is two edits and no more: write the component, add an entry
 * here. Nothing else in the codebase enumerates templates.
 */
export type SlotKey =
  | 'imageField'
  | 'priceField'
  | 'badgeField'
  | 'linkField'
  | 'bodyField'
  | 'metaFields'

export type SlotSpec = {
  key: SlotKey
  label: string
  help: string
  required?: boolean
}

export type TemplateInfo = {
  label: string
  description: string
  /** True when visitors submit through this template rather than only reading. */
  collectsSubmissions: boolean
  slots: SlotSpec[]
}

const SLOTS: Record<SlotKey, SlotSpec> = {
  imageField: {
    key: 'imageField',
    label: 'Image',
    help: 'Which field holds the picture.',
  },
  priceField: {
    key: 'priceField',
    label: 'Price',
    help: 'Shown large, in your chosen currency.',
  },
  badgeField: {
    key: 'badgeField',
    label: 'Badge',
    help: 'A short status shown in the corner. Works best with a choice field.',
  },
  linkField: {
    key: 'linkField',
    label: 'Link',
    help: 'Where tapping the entry takes the visitor.',
  },
  bodyField: {
    key: 'bodyField',
    label: 'Body text',
    help: 'The longer text shown under the title.',
  },
  metaFields: {
    key: 'metaFields',
    label: 'Details line',
    help: 'Up to four small facts shown on one line.',
  },
}

export const TEMPLATE_INFO: Record<PublicTemplate, TemplateInfo> = {
  listings: {
    label: 'Cards with photo and price',
    description:
      'The most flexible block: photo, title, price, status badge and a details line. Properties, vehicles, stock, services — anything you list.',
    collectsSubmissions: false,
    slots: [SLOTS.imageField, SLOTS.priceField, SLOTS.badgeField, SLOTS.linkField, SLOTS.bodyField, SLOTS.metaFields],
  },
  catalog: {
    label: 'Priced list',
    description: 'A menu-style list, optionally split into sections. Compact and quick to scan.',
    collectsSubmissions: false,
    slots: [],
  },
  actions: {
    label: 'Action buttons',
    description: 'Big tappable buttons. Call, message, book, pay, directions.',
    collectsSubmissions: false,
    slots: [{ ...SLOTS.linkField, required: true }, SLOTS.badgeField],
  },
  links: {
    label: 'Link list',
    description: 'A stack of links, as plain rows or as buttons.',
    collectsSubmissions: false,
    slots: [{ ...SLOTS.linkField, required: true }],
  },
  socials: {
    label: 'Social icons',
    description: 'A compact row of profiles that sits neatly under your name.',
    collectsSubmissions: false,
    slots: [{ ...SLOTS.linkField, required: true }],
  },
  gallery: {
    label: 'Photo gallery',
    description: 'A grid or scrolling strip of images with optional captions.',
    collectsSubmissions: false,
    slots: [{ ...SLOTS.imageField, required: true }, SLOTS.linkField],
  },
  faq: {
    label: 'Questions and answers',
    description: 'Tap-to-expand entries. Good for anything you explain repeatedly.',
    collectsSubmissions: false,
    slots: [{ ...SLOTS.bodyField, required: true }],
  },
  embed: {
    label: 'Video',
    description: 'A YouTube or Vimeo player. No other host can be embedded.',
    collectsSubmissions: false,
    slots: [{ ...SLOTS.linkField, required: true }],
  },
  form: {
    label: 'Form visitors fill in',
    description:
      'Collects entries from anyone with the link and puts them in your dashboard. Enquiries, requests, sign-ups, orders.',
    collectsSubmissions: true,
    slots: [],
  },
  board: {
    label: 'Public feed',
    description: 'Shows entries publicly, newest first. Notices, updates, a shared list.',
    collectsSubmissions: false,
    slots: [SLOTS.bodyField],
  },
}

export const TEMPLATE_ORDER: PublicTemplate[] = [
  'listings',
  'actions',
  'form',
  'links',
  'gallery',
  'faq',
  'catalog',
  'socials',
  'embed',
  'board',
]

export type { DisplayVariant, PublicTemplate }
