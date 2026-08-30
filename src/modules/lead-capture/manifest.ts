import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'lead-capture',
  version: '1.0.0',
  name: 'Enquiry Form',
  tagline: 'Catch the people who are ready to talk.',
  description:
    'A short form on your page. Every enquiry lands in your dashboard with a status you can work through, so nothing gets lost in a chat thread.',
  icon: '📥',
  accent: '#c0562a',
  category: 'operations',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'collect_submissions', 'store_records', 'generate_qr'],
  settings: [
    {
      key: 'accepting',
      label: 'Accepting enquiries',
      type: 'boolean',
      required: false,
      defaultValue: true,
      ownerOnly: false,
    },
    {
      key: 'intro',
      label: 'Message above the form',
      type: 'longtext',
      required: false,
      placeholder: 'Tell me what you are looking for and I will come back to you today.',
      maxLength: 300,
      ownerOnly: false,
    },
  ],
  collections: {
    enquiries: {
      label: 'Enquiries',
      labelSingular: 'Enquiry',
      titleField: 'name',
      subtitleField: 'interest',
      groupField: 'status',
      sortable: false,
      publicRead: false,
      publicWrite: true,
      publicWriteCta: 'Send enquiry',
      fields: [
        { key: 'name', label: 'Your name', type: 'text', required: true, maxLength: 80, ownerOnly: false },
        { key: 'email', label: 'Email', type: 'email', required: true, ownerOnly: false },
        { key: 'phone', label: 'Phone', type: 'phone', required: false, ownerOnly: false },
        {
          key: 'interest',
          label: 'What can I help with?',
          type: 'select',
          required: false,
          ownerOnly: false,
          options: [
            { value: 'buying', label: 'Buying' },
            { value: 'selling', label: 'Selling' },
            { value: 'renting', label: 'Renting' },
            { value: 'valuation', label: 'A valuation' },
            { value: 'other', label: 'Something else' },
          ],
        },
        {
          key: 'message',
          label: 'Message',
          type: 'longtext',
          required: false,
          maxLength: 800,
          ownerOnly: false,
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: false,
          defaultValue: 'new',
          ownerOnly: true,
          options: [
            { value: 'new', label: 'New' },
            { value: 'contacted', label: 'Contacted' },
            { value: 'won', label: 'Won' },
            { value: 'closed', label: 'Closed' },
          ],
        },
      ],
    },
  },
  publicSurface: {
    template: 'form',
    collection: 'enquiries',
    submitCollection: 'enquiries',
    heading: 'Get in touch',
    defaultVariant: 'feature',
  },
}

export default manifest
