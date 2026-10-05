// retired: definitions live in apps/*/manifest.json
// This starter is frozen. It is read only by the retired platform
// (APP_BUILD_LEGACY_PLATFORM=on): catalogue, demo page, seed and layouts.
import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'listings',
  version: '1.0.0',
  name: 'Listings',
  tagline: 'Show what you have on the market, with a way to reach you on every one.',
  description:
    'Properties, vehicles, inventory — anything you list. Each entry gets a photo, a price, a status badge and its own details. Visitors go from the thing they are interested in straight to contacting you.',
  icon: '🏠',
  accent: '#1f3b73',
  category: 'commerce',
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
  ],
  collections: {
    properties: {
      label: 'Listings',
      labelSingular: 'Listing',
      titleField: 'title',
      subtitleField: 'price',
      groupField: 'status',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 120, ownerOnly: false },
        {
          key: 'address',
          label: 'Address or location',
          type: 'text',
          required: false,
          maxLength: 160,
          ownerOnly: false,
        },
        { key: 'price', label: 'Price', type: 'money', required: false, min: 0, ownerOnly: false },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          defaultValue: 'active',
          ownerOnly: false,
          options: [
            { value: 'active', label: 'For sale' },
            { value: 'pending', label: 'Under offer' },
            { value: 'sold', label: 'Sold' },
            { value: 'rental', label: 'For rent' },
          ],
        },
        {
          key: 'image_url',
          label: 'Photo URL',
          type: 'image',
          required: false,
          help: 'Paste a link to a hosted photo.',
          ownerOnly: false,
        },
        { key: 'beds', label: 'Bedrooms', type: 'number', required: false, min: 0, max: 99, ownerOnly: false },
        { key: 'baths', label: 'Bathrooms', type: 'number', required: false, min: 0, max: 99, ownerOnly: false },
        { key: 'area', label: 'Size', type: 'text', required: false, maxLength: 40, ownerOnly: false },
        {
          key: 'description',
          label: 'Description',
          type: 'longtext',
          required: false,
          maxLength: 800,
          ownerOnly: false,
        },
        {
          key: 'link_url',
          label: 'Full details link',
          type: 'url',
          required: false,
          help: 'Optional — where the listing lives in full.',
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
    template: 'listings',
    collection: 'properties',
    heading: 'Listings',
    defaultVariant: 'grid',
    imageField: 'image_url',
    priceField: 'price',
    badgeField: 'status',
    linkField: 'link_url',
    bodyField: 'description',
    metaFields: ['beds', 'baths', 'area'],
  },
}

export default manifest
