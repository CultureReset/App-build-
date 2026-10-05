// retired: definitions live in apps/*/manifest.json
// This starter is frozen. It is read only by the retired platform
// (APP_BUILD_LEGACY_PLATFORM=on): catalogue, demo page, seed and layouts.
import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'qr-menu',
  version: '1.0.0',
  name: 'QR Menu',
  tagline: 'A live menu customers scan at the table.',
  description:
    'Keep your menu in one place and let customers scan a QR code to read it on their phone. Change a price and it changes everywhere instantly — no reprinting, no PDFs.',
  icon: '🍽️',
  accent: '#e2703a',
  category: 'hospitality',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'store_records', 'generate_qr'],
  settings: [
    {
      key: 'currency',
      label: 'Currency symbol',
      type: 'text',
      required: false,
      defaultValue: '$',
      maxLength: 3,
      ownerOnly: false,
    },
    {
      key: 'footer_note',
      label: 'Footer note',
      type: 'longtext',
      required: false,
      placeholder: 'Allergies? Please tell your server.',
      maxLength: 300,
      ownerOnly: false,
    },
  ],
  collections: {
    items: {
      label: 'Menu items',
      labelSingular: 'Menu item',
      titleField: 'name',
      subtitleField: 'price',
      groupField: 'section',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, maxLength: 120, ownerOnly: false },
        {
          key: 'description',
          label: 'Description',
          type: 'longtext',
          required: false,
          maxLength: 400,
          ownerOnly: false,
        },
        { key: 'price', label: 'Price', type: 'money', required: true, min: 0, ownerOnly: false },
        {
          key: 'section',
          label: 'Section',
          type: 'select',
          required: true,
          ownerOnly: false,
          options: [
            { value: 'starters', label: 'Starters' },
            { value: 'mains', label: 'Mains' },
            { value: 'sides', label: 'Sides' },
            { value: 'desserts', label: 'Desserts' },
            { value: 'drinks', label: 'Drinks' },
          ],
        },
        {
          key: 'available',
          label: 'Available',
          type: 'boolean',
          required: false,
          defaultValue: true,
          ownerOnly: false,
        },
      ],
    },
  },
  publicSurface: {
    template: 'catalog',
    collection: 'items',
    heading: 'Menu',
  },
}

export default manifest
