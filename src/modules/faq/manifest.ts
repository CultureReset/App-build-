import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'faq',
  version: '1.0.0',
  name: 'FAQ',
  tagline: 'Answer the questions before they are asked.',
  description:
    'A tidy list of questions and answers that expand when tapped. Cuts down the same five messages you answer every week.',
  icon: '❓',
  accent: '#3d6d8f',
  category: 'content',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'store_records', 'generate_qr'],
  settings: [],
  collections: {
    entries: {
      label: 'Questions',
      labelSingular: 'Question',
      titleField: 'question',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        { key: 'question', label: 'Question', type: 'text', required: true, maxLength: 160, ownerOnly: false },
        { key: 'answer', label: 'Answer', type: 'longtext', required: true, maxLength: 1200, ownerOnly: false },
        {
          key: 'visible',
          label: 'Visible',
          type: 'boolean',
          required: false,
          defaultValue: true,
          ownerOnly: false,
        },
      ],
    },
  },
  publicSurface: {
    template: 'faq',
    collection: 'entries',
    heading: 'Questions',
    defaultVariant: 'accordion',
    bodyField: 'answer',
  },
}

export default manifest
