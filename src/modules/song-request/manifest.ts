import type { ModuleManifest } from '@/lib/modules/spec'

const manifest: ModuleManifest = {
  id: 'song-request',
  version: '1.0.0',
  name: 'Song Requests',
  tagline: 'Let the room send you tracks without shouting over the music.',
  description:
    'Visitors scan a code and send a request. Every request lands in your queue where you can play it, skip it, or hide it. The crowd never sees the queue unless you want them to.',
  icon: '🎧',
  accent: '#7c5cff',
  category: 'events',
  author: { name: 'Platform', handle: 'platform' },
  pricing: { model: 'free', amountCents: 0 },
  permissions: ['public_page', 'collect_submissions', 'store_records', 'generate_qr'],
  settings: [
    {
      key: 'accepting',
      label: 'Accepting requests',
      type: 'boolean',
      required: false,
      defaultValue: true,
      help: 'Turn this off to close the queue between sets.',
      ownerOnly: false,
    },
    {
      key: 'intro',
      label: 'Message above the form',
      type: 'longtext',
      required: false,
      placeholder: 'One request per person, please.',
      maxLength: 300,
      ownerOnly: false,
    },
  ],
  collections: {
    requests: {
      label: 'Requests',
      labelSingular: 'Request',
      titleField: 'song',
      subtitleField: 'artist',
      groupField: 'status',
      sortable: false,
      publicRead: false,
      publicWrite: true,
      publicWriteCta: 'Send a request',
      fields: [
        { key: 'song', label: 'Song', type: 'text', required: true, maxLength: 120, ownerOnly: false },
        { key: 'artist', label: 'Artist', type: 'text', required: false, maxLength: 120, ownerOnly: false },
        {
          key: 'from',
          label: 'Your name',
          type: 'text',
          required: false,
          maxLength: 60,
          ownerOnly: false,
        },
        {
          key: 'note',
          label: 'Note for the DJ',
          type: 'longtext',
          required: false,
          maxLength: 240,
          ownerOnly: false,
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: false,
          defaultValue: 'pending',
          ownerOnly: true,
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'queued', label: 'Queued' },
            { value: 'played', label: 'Played' },
            { value: 'hidden', label: 'Hidden' },
          ],
        },
      ],
    },
  },
  publicSurface: {
    template: 'form',
    collection: 'requests',
    submitCollection: 'requests',
    heading: 'Request a song',
  },
}

export default manifest
