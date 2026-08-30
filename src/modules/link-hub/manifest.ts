import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'link-hub',
  version: '1.0.0',
  name: 'Link Hub',
  tagline: 'Every link you hand out, in one block on your page.',
  description:
    'A tidy stack of links — booking, socials, your menu, whatever you point people at. Reorder them any time and the public page updates immediately.',
  icon: '🔗',
  accent: '#2ba05a',
  category: 'content',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'store_records'],
  settings: [],
  collections: {
    links: {
      label: 'Links',
      labelSingular: 'Link',
      titleField: 'label',
      subtitleField: 'url',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        { key: 'label', label: 'Label', type: 'text', required: true, maxLength: 80, ownerOnly: false },
        { key: 'url', label: 'URL', type: 'url', required: true, ownerOnly: false },
        {
          key: 'description',
          label: 'Short description',
          type: 'text',
          required: false,
          maxLength: 120,
          ownerOnly: false,
        },
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
    template: 'links',
    collection: 'links',
    heading: 'Links',
  },
}

export default manifest
