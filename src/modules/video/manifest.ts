// retired: definitions live in apps/*/manifest.json
// This starter is frozen. It is read only by the retired platform
// (APP_BUILD_LEGACY_PLATFORM=on): catalogue, demo page, seed and layouts.
import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'video',
  version: '1.0.0',
  name: 'Video',
  tagline: 'An intro clip, a walkthrough, a tour.',
  description:
    'Embed a YouTube or Vimeo video on your page. Nothing else is allowed to embed, so the page stays fast and nothing can track your visitors without you knowing.',
  icon: '▶️',
  accent: '#cc3b3b',
  category: 'content',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'store_records', 'generate_qr'],
  settings: [],
  collections: {
    videos: {
      label: 'Videos',
      labelSingular: 'Video',
      titleField: 'title',
      subtitleField: 'video_url',
      sortable: true,
      publicRead: true,
      publicWrite: false,
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: false, maxLength: 120, ownerOnly: false },
        {
          key: 'video_url',
          label: 'YouTube or Vimeo link',
          type: 'url',
          required: true,
          placeholder: 'https://www.youtube.com/watch?v=…',
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
    template: 'embed',
    collection: 'videos',
    heading: 'Watch',
    defaultVariant: 'feature',
    linkField: 'video_url',
  },
}

export default manifest
