import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'action-buttons',
  version: '1.0.0',
  name: 'Action Buttons',
  tagline: 'Call, message, book, save your contact — one tap each.',
  description:
    'The row of buttons that turns a visitor into a conversation. Point them at a phone number, a WhatsApp thread, an email, a booking link or anything else you use.',
  icon: '⚡',
  accent: '#0f9d6e',
  category: 'content',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'store_records'],
  settings: [],
  collections: {
    actions: {
      label: 'Buttons',
      labelSingular: 'Button',
      titleField: 'label',
      subtitleField: 'url',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        { key: 'label', label: 'Button text', type: 'text', required: true, maxLength: 40, ownerOnly: false },
        {
          key: 'icon',
          label: 'Icon',
          type: 'select',
          required: false,
          defaultValue: 'arrow',
          ownerOnly: false,
          options: [
            { value: 'arrow', label: '→  Arrow' },
            { value: 'phone', label: '📞  Phone' },
            { value: 'message', label: '💬  Message' },
            { value: 'mail', label: '✉️  Email' },
            { value: 'calendar', label: '📅  Calendar' },
            { value: 'map', label: '📍  Location' },
            { value: 'card', label: '💳  Payment' },
            { value: 'download', label: '⬇️  Download' },
            { value: 'star', label: '⭐  Review' },
          ],
        },
        {
          key: 'url',
          label: 'Link',
          type: 'url',
          required: true,
          help: 'A web link, or a tel:/mailto: style link written out in full.',
          ownerOnly: false,
        },
        {
          key: 'style',
          label: 'Emphasis',
          type: 'select',
          required: false,
          defaultValue: 'primary',
          ownerOnly: false,
          options: [
            { value: 'primary', label: 'Primary' },
            { value: 'secondary', label: 'Secondary' },
          ],
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
    template: 'actions',
    collection: 'actions',
    heading: 'Get in touch',
    defaultVariant: 'buttons',
    linkField: 'url',
    badgeField: 'icon',
  },
}

export default manifest
