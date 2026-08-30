import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'gallery',
  version: '1.0.0',
  name: 'Gallery',
  tagline: 'Photos of the work, the room, the product.',
  description:
    'A grid of images with optional captions. Useful anywhere the thing you do is easier to show than to describe.',
  icon: '🖼️',
  accent: '#7a5cc4',
  category: 'content',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'store_records', 'generate_qr'],
  settings: [],
  collections: {
    photos: {
      label: 'Photos',
      labelSingular: 'Photo',
      titleField: 'caption',
      subtitleField: 'image_url',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        { key: 'image_url', label: 'Image URL', type: 'image', required: true, ownerOnly: false },
        { key: 'caption', label: 'Caption', type: 'text', required: false, maxLength: 120, ownerOnly: false },
        { key: 'link_url', label: 'Links to', type: 'url', required: false, ownerOnly: false },
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
    template: 'gallery',
    collection: 'photos',
    heading: 'Gallery',
    defaultVariant: 'grid',
    imageField: 'image_url',
    linkField: 'link_url',
  },
}

export default manifest
