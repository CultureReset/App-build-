// A small manifest that uses every view type, and sample rows built from
// field types. Nothing here is an app; it only exercises the engine.

export function sampleManifest(overrides = {}) {
  return {
    schema_version: 1,
    id: 'test-sample',
    name: 'Sample',
    summary: 'Exercises every view.',
    version: '1.2.3',
    publisher: 'test',
    runtime: { type: 'engine', engine: '1' },
    surfaces: [
      { id: 'owner', kind: 'dashboard', path: '/owner' },
      { id: 'public', kind: 'public', title: 'Sample', path: '/public' },
      { id: 'tv', kind: 'widget', path: '/tv' },
    ],
    permissions: [
      { id: 'things:read', reason: 'Shows the business things.' },
      { id: 'things:write', reason: 'Edits the business things.', optional: true },
    ],
    data: {
      namespace: 'sample',
      tables: {
        notes: {
          public: 'read-append',
          columns: {
            title: { type: 'text', required: true },
            body: { type: 'text' },
            kind: { type: 'text' },
            link: { type: 'text' },
            picture: { type: 'text' },
            amount: { type: 'money' },
            count: { type: 'integer' },
            shown: { type: 'boolean' },
            secret_flag: { type: 'text' },
            position: { type: 'integer' },
          },
        },
      },
    },
    config: [
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'open', label: 'Open', type: 'boolean', default: true },
      { key: 'intro', label: 'Intro', type: 'text', default: 'Say hello.' },
      { key: 'api_key', label: 'Key', type: 'secret' },
    ],
    pricing: { model: 'free' },
    ui: {
      format: { currency: { setting: 'currency' } },
      sources: {
        groups: {
          from: 'business', section: 'thing_groups', resource: 'things', label: 'Groups', labelSingular: 'Group',
          fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
          title: 'name',
        },
        things: {
          from: 'business', section: 'things', resource: 'things', label: 'Things', labelSingular: 'Thing',
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'price', label: 'Price', type: 'money' },
            { key: 'group_id', label: 'Group', type: 'select', optionsFrom: { source: 'groups', label: 'name' } },
          ],
          title: 'name', subtitle: 'price', group: 'group_id', order: 'sort_order', sortable: true,
        },
        notes: {
          from: 'app', table: 'notes', label: 'Notes', labelSingular: 'Note',
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 50 },
            { key: 'body', label: 'Body', type: 'longtext' },
            { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'a', label: 'Alpha', icon: 'α' }, { value: 'b', label: 'Beta', icon: 'β' }] },
            { key: 'link', label: 'Link', type: 'url' },
            { key: 'picture', label: 'Picture', type: 'image' },
            { key: 'amount', label: 'Amount', type: 'money' },
            { key: 'count', label: 'Rooms', type: 'number' },
            { key: 'shown', label: 'Shown', type: 'boolean', default: true },
            { key: 'secret_flag', label: 'Flag', type: 'text', ownerOnly: true, default: 'new' },
          ],
          title: 'title', subtitle: 'kind', group: 'kind', order: 'position', sortable: true, visibleWhen: 'shown',
        },
      },
      views: {
        owner: [{ type: 'collection', source: 'notes' }, { type: 'collection', source: 'things' }, { type: 'settings' }],
        public: [
          { type: 'list', source: 'things', fields: { title: 'name', value: 'price' } },
          { type: 'list', source: 'notes', style: 'cards', fields: { title: 'title', body: 'body', image: 'picture', value: 'amount', badge: 'kind', link: 'link', meta: ['count'] } },
          { type: 'links', source: 'notes', style: 'icons', fields: { label: 'kind', icon: 'kind', link: 'link' } },
          { type: 'images', source: 'notes', fields: { image: 'picture', caption: 'title', link: 'link' } },
          { type: 'details', source: 'notes', fields: { summary: 'title', body: 'body' } },
          { type: 'embed', source: 'notes', style: 'stack', fields: { link: 'link', title: 'title' } },
          { type: 'feed', source: 'notes', fields: { title: 'title', body: 'body' } },
          { type: 'form', source: 'notes', intro: { setting: 'intro' }, openWhen: { setting: 'open' } },
          { type: 'text', text: { setting: 'intro' } },
        ],
        tv: [{ type: 'list', source: 'notes', style: 'grid', fields: { title: 'title' } }],
      },
    },
    ...overrides,
  }
}

export function sampleData() {
  return {
    groups: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }],
    things: [
      { id: 't1', name: 'One', price: 12.5, group_id: 1, sort_order: 2 },
      { id: 't2', name: 'Two', price: 1000, group_id: 2, sort_order: 1 },
      { id: 't3', name: 'Loose', price: null, group_id: null, sort_order: 3 },
    ],
    notes: [
      { id: 'n1', title: 'Hello', body: 'World', kind: 'a', link: 'https://video.example.test/watch?v=abcdef123', picture: 'https://img.example.test/1.png', amount: 3, count: 2, shown: true, secret_flag: 'private-value', position: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 'n2', title: 'Hidden', body: 'nope', kind: 'b', shown: false, position: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 'n3', title: '<script>alert(1)</script>', body: 'x', kind: 'b', link: 'javascript:alert(1)', picture: 'data:image/png;base64,AAA', shown: true, position: 3, created_at: '2026-01-03T00:00:00Z' },
    ],
  }
}

export const EMBEDS = [{ hosts: ['video.example.test'], id: { from: 'query', param: 'v' }, pattern: '^[a-z0-9]{6,20}$', src: 'https://player.example.test/embed/{id}' }]
