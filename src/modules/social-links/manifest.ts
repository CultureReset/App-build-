import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'social-links',
  version: '1.0.0',
  name: 'Social Links',
  tagline: 'Every profile you keep, in one compact row.',
  description:
    'Instagram, LinkedIn, YouTube, TikTok, X, Facebook and the rest. Sits neatly under your name rather than eating a whole section.',
  icon: '🌐',
  accent: '#5b6478',
  category: 'content',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'store_records'],
  settings: [],
  collections: {
    profiles: {
      label: 'Profiles',
      labelSingular: 'Profile',
      titleField: 'network',
      subtitleField: 'url',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        {
          key: 'network',
          label: 'Network',
          type: 'select',
          required: true,
          ownerOnly: false,
          options: [
            { value: 'instagram', label: 'Instagram' },
            { value: 'facebook', label: 'Facebook' },
            { value: 'linkedin', label: 'LinkedIn' },
            { value: 'youtube', label: 'YouTube' },
            { value: 'tiktok', label: 'TikTok' },
            { value: 'x', label: 'X' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'threads', label: 'Threads' },
            { value: 'pinterest', label: 'Pinterest' },
            { value: 'spotify', label: 'Spotify' },
            { value: 'website', label: 'Website' },
          ],
        },
        { key: 'url', label: 'Link', type: 'url', required: true, ownerOnly: false },
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
    template: 'socials',
    collection: 'profiles',
    heading: 'Elsewhere',
    defaultVariant: 'icons',
    linkField: 'url',
  },
}

export default manifest
