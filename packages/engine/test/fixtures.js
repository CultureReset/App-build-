// A small manifest that uses every view type, and sample rows built from
// field types. Nothing here is an app; it only exercises the engine.

import { viewModule } from '../src/index.js'

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

/**
 * A manifest that uses every template view type (views/*.js) over fixture
 * sources shaped like the contracts they are meant for, and plainly fake rows.
 * Source keys are deliberately not the template names.
 */
function ownerViews(list) {
  const registered = list.filter((v) => viewModule(v.type))
  return registered.length ? registered : [{ type: 'collection', source: 'photos' }]
}

export function templatesManifest(overrides = {}) {
  const img = (key) => ({ key, label: 'Image', type: 'image' })
  return {
    schema_version: 1,
    id: 'test-templates',
    name: 'Templates',
    version: '1.0.0',
    publisher: 'test',
    runtime: { type: 'engine', engine: '1' },
    surfaces: [
      { id: 'owner', kind: 'dashboard', path: '/owner' },
      { id: 'public', kind: 'public', title: 'Public', path: '/public' },
    ],
    permissions: [
      { id: 'business:read', reason: 'Reads the business profile, photos, links and catalogue.' },
      { id: 'business:write', reason: 'Edits them from inside this app.' },
      { id: 'menu:read', reason: 'Reads the menu sections and items.' },
      { id: 'menu:write', reason: 'Edits the menu from inside this app.' },
      { id: 'availability:read', reason: 'Reads the dates the business has claimed.' },
      { id: 'availability:write', reason: 'Adds and removes claims from inside this app.' },
    ],
    bindings: {
      place: { contract: 'business.profile', access: 'read-write' },
      links: { contract: 'business.links', access: 'read-write' },
      media: { contract: 'media.images', access: 'read-write' },
      sections: { contract: 'menu.sections', access: 'read-write' },
      items: { contract: 'menu.items', access: 'read-write' },
      offers: { contract: 'listings.items', access: 'read-write' },
      claims: { contract: 'availability.claims', access: 'read-write' },
    },
    pricing: { model: 'free' },
    ui: {
      format: { currency: 'EUR' },
      sources: {
        place: {
          from: 'business', binding: 'place', label: 'Place', labelSingular: 'Place',
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'subtitle', label: 'Tagline', type: 'text' },
            { key: 'description', label: 'About', type: 'longtext' },
            { key: 'address', label: 'Address', type: 'text' },
            { key: 'address_display', label: 'Address shown', type: 'text', readOnly: true },
            { key: 'logo_url', label: 'Logo', type: 'image' },
            { key: 'hero_image_url', label: 'Cover', type: 'image' },
            { key: 'phone', label: 'Phone', type: 'phone' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'website_url', label: 'Website', type: 'url' },
            { key: 'booking_url', label: 'Booking link', type: 'url' },
            { key: 'directions_url', label: 'Directions link', type: 'url' },
          ],
          title: 'name',
        },
        elsewhere: {
          from: 'business', binding: 'links', label: 'Links', labelSingular: 'Link',
          fields: [{ key: 'network', label: 'Network', type: 'text', required: true }, { key: 'url', label: 'Link', type: 'url', required: true }],
          title: 'network',
        },
        photos: {
          from: 'business', binding: 'media', label: 'Photos', labelSingular: 'Photo',
          fields: [img('url'), { key: 'caption', label: 'Caption', type: 'text' }, { key: 'is_cover', label: 'Cover', type: 'boolean', default: false }],
          title: 'caption', order: 'sort_order', sortable: true,
        },
        categories: {
          from: 'business', binding: 'sections', label: 'Categories', labelSingular: 'Category',
          fields: [{ key: 'section_name', label: 'Name', type: 'text', required: true }],
          title: 'section_name', order: 'sort_order', sortable: true,
        },
        dishes: {
          from: 'business', binding: 'items', label: 'Dishes', labelSingular: 'Dish',
          fields: [
            { key: 'item_name', label: 'Name', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'longtext' },
            { key: 'price', label: 'Price', type: 'money', min: 0 },
            img('image_url'),
            { key: 'tags', label: 'Tags', type: 'tags' },
            { key: 'section_id', label: 'Category', type: 'select', optionsFrom: { source: 'categories', label: 'section_name' } },
            { key: 'is_available', label: 'Available', type: 'boolean', default: true },
          ],
          title: 'item_name', group: 'section_id', order: 'sort_order', sortable: true, visibleWhen: 'is_available',
        },
        catalogue: {
          from: 'business', binding: 'offers', label: 'Catalogue', labelSingular: 'Entry',
          fields: [
            { key: 'name', label: 'Title', type: 'text', required: true },
            { key: 'kind', label: 'Kind', type: 'text' },
            { key: 'unit', label: 'Unit', type: 'text' },
            { key: 'price_from', label: 'Price', type: 'money' },
            { key: 'capacity', label: 'Capacity', type: 'number' },
            { key: 'description', label: 'Description', type: 'longtext' },
            img('image_url'),
            { key: 'active', label: 'Shown', type: 'boolean', default: true },
          ],
          title: 'name', order: 'sort_order', sortable: true, visibleWhen: 'active',
        },
        claims: {
          from: 'business', binding: 'claims', label: 'Claims', labelSingular: 'Claim',
          fields: [
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'date', label: 'Date', type: 'date', required: true },
            { key: 'end_date', label: 'Until', type: 'date' },
            { key: 'start_time', label: 'Time', type: 'time' },
            { key: 'status', label: 'Status', type: 'text' },
            { key: 'party', label: 'Party', type: 'number' },
          ],
          title: 'title',
        },
      },
      views: {
        // Only the admin templates that are registered (the public group can ship
        // alone; with none, a core collection keeps the owner view set non-empty).
        owner: ownerViews([
          { type: 'profile-editor', source: 'place', fields: { location: 'address_display' } },
          { type: 'media-manager', source: 'photos', fields: { image: 'url', caption: 'caption', cover: 'is_cover' } },
          { type: 'menu-editor', source: 'dishes', fields: { title: 'item_name', price: 'price', available: 'is_available', image: 'image_url', description: 'description', badges: 'tags' } },
          { type: 'listing-manager', source: 'catalogue', fields: { title: 'name', image: 'image_url', kind: 'kind', price: 'price_from', unit: 'unit', capacity: 'capacity', description: 'description' } },
          { type: 'availability-calendar', source: 'claims', style: 'month', fields: { date: 'date', end: 'end_date', time: 'start_time', status: 'status', capacity: 'party', title: 'title' } },
        ]),
        public: [
          { type: 'profile', source: 'place', heading: 'About', fields: { name: 'name', tagline: 'subtitle', description: 'description', location: 'address', image: 'logo_url', cover: 'hero_image_url', phone: 'phone', email: 'email', link: 'website_url', book: 'booking_url', directions: 'directions_url' } },
          { type: 'actions', source: 'place', heading: 'Reach us', style: 'icons', fields: { phone: 'phone', sms: 'phone', email: 'email', link: 'website_url', book: 'booking_url', directions: 'directions_url' } },
          { type: 'social', source: 'elsewhere', heading: 'Elsewhere', fields: { label: 'network', link: 'url' } },
          { type: 'gallery', source: 'photos', heading: 'Photos', fields: { image: 'url', caption: 'caption', cover: 'is_cover' } },
          { type: 'menu', source: 'dishes', heading: 'Menu', fields: { title: 'item_name', description: 'description', price: 'price', image: 'image_url', badges: 'tags', available: 'is_available' } },
          { type: 'listings', source: 'catalogue', heading: 'Listings', fields: { title: 'name', image: 'image_url', kind: 'kind', price: 'price_from', unit: 'unit', capacity: 'capacity', description: 'description' } },
          { type: 'availability', source: 'claims', heading: 'Dates', fields: { date: 'date', end: 'end_date', time: 'start_time', status: 'status', capacity: 'party', title: 'title' } },
        ],
      },
    },
    ...overrides,
  }
}

export function templatesData() {
  return {
    place: [{
      id: 'b1', name: 'Place 1', subtitle: 'Tagline 1', description: '<b>Place 1</b> is a place.', address: 'Street 1', address_display: 'Street 1, Town 1', logo_url: 'https://img.example.test/logo.png',
      hero_image_url: 'https://img.example.test/hero.png', phone: '+1 555 0101', email: 'hello@example.test', website_url: 'https://example.test',
      booking_url: 'https://book.example.test', directions_url: 'https://maps.example.test/x',
    }],
    elsewhere: [
      { id: 'network_a', network: 'Network A', url: 'https://a.example.test' },
      { id: 'network_b', network: 'Network B', url: 'https://b.example.test' },
      { id: 'bad', network: 'Bad', url: 'javascript:alert(1)' },
    ],
    photos: [
      { id: 'p1', url: 'https://img.example.test/1.png', caption: 'Photo 1', is_cover: false, sort_order: 1 },
      { id: 'p2', url: 'https://img.example.test/2.png', caption: 'Photo 2', is_cover: false, sort_order: 2 },
      { id: 'p3', url: 'https://img.example.test/3.png', caption: 'Photo 3', is_cover: true, sort_order: 3 },
      { id: 'p4', url: 'data:image/png;base64,AAA', caption: 'Photo 4', is_cover: false, sort_order: 4 },
    ],
    categories: [{ id: 'c1', section_name: 'Category 1', sort_order: 1 }, { id: 'c2', section_name: 'Category 2', sort_order: 2 }],
    dishes: [
      { id: 'd1', item_name: 'Item 1', description: 'Description 1', price: 9.5, image_url: 'https://img.example.test/d1.png', tags: ['Tag A', 'Tag B'], section_id: 'c1', is_available: true, sort_order: 1 },
      { id: 'd2', item_name: 'Item 2', description: 'Description 2', price: 12, section_id: 'c1', is_available: false, sort_order: 2 },
      { id: 'd3', item_name: 'Item 3', price: 4, section_id: 'c2', is_available: true, sort_order: 3 },
    ],
    catalogue: [
      { id: 'l1', name: 'Listing 1', kind: 'Kind A', unit: 'per unit', price_from: 100, capacity: 4, description: 'Listing 1 description', image_url: 'https://img.example.test/l1.png', active: true, sort_order: 1 },
      { id: 'l2', name: 'Listing 2', kind: 'Kind B', price_from: 50, active: false, sort_order: 2 },
      { id: 'l3', name: 'Listing 3', kind: 'Kind A', price_from: 80, active: true, sort_order: 3 },
      { id: 'l4', name: 'Listing 4', kind: 'Kind B', price_from: 60, active: true, sort_order: 4 },
    ],
    claims: [
      { id: 'k1', title: 'Claim 1', date: '2026-03-12', end_date: '2026-03-13', start_time: '18:00', status: 'active', party: 2 },
      { id: 'k2', title: 'Claim 2', date: '2026-03-14', status: 'active', party: 3 },
    ],
  }
}
