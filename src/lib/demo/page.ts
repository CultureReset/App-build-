import { getModule } from '@/lib/modules/registry'
import type { InstallRow, ProfileRow, RecordRow } from '@/lib/supabase/types'
import type { ModuleManifest } from '@/lib/modules/spec'

/**
 * Sample content for the live preview at /preview.
 *
 * This exists so the public renderer can be seen and judged without a database
 * behind it. It is ordinary data handed to the ordinary components — the
 * preview shares the real templates, so what it shows is what ships.
 */
let sequence = 0

function nextId(): string {
  sequence += 1
  return `demo-${sequence}`
}

function install(
  moduleId: string,
  overrides: Partial<InstallRow> & { name: string; public_position: number },
): InstallRow {
  const manifest = getModule(moduleId)!

  return {
    id: `install-${moduleId}`,
    owner_id: 'demo-owner',
    module_id: moduleId,
    module_version: manifest.version,
    slug: moduleId,
    config: {},
    granted_permissions: manifest.permissions,
    enabled: true,
    public_enabled: true,
    public_read_collections: [],
    public_write_collections: [],
    accepting_submissions: true,
    display_variant: null,
    public_heading: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function records(
  installId: string,
  collection: string,
  rows: Record<string, unknown>[],
): RecordRow[] {
  return rows.map((data, index) => ({
    id: nextId(),
    install_id: installId,
    owner_id: 'demo-owner',
    collection,
    data,
    position: index,
    submitted_by_public: false,
    created_at: new Date(Date.now() - index * 3_600_000).toISOString(),
    updated_at: new Date().toISOString(),
  }))
}

export type DemoBlock = { install: InstallRow; manifest: ModuleManifest; records: RecordRow[] }

export const demoProfile: ProfileRow = {
  id: 'demo-owner',
  handle: 'dana',
  display_name: 'Dana Whitfield',
  tagline: 'Realtor · Northside & Ridgeway',
  bio: 'Fifteen years selling on the north side. Here to answer questions, not to chase you.',
  accent: '#1f3b73',
  avatar_url: null,
  theme: {},
  page_published: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export function demoBlocks(): DemoBlock[] {
  const socials = install('social-links', {
    name: 'Elsewhere',
    public_position: 0,
    public_heading: '',
  })
  const actions = install('action-buttons', {
    name: 'Contact',
    public_position: 1,
    public_heading: '',
    display_variant: 'grid',
  })
  const listings = install('listings', {
    name: 'My listings',
    public_position: 2,
    public_heading: 'Listings',
    config: { currency: '$' },
  })
  const faq = install('faq', {
    name: 'FAQ',
    public_position: 3,
    public_heading: 'Common questions',
  })
  const enquiries = install('lead-capture', {
    name: 'Enquiries',
    public_position: 4,
    public_heading: 'Get in touch',
    config: { accepting: true, intro: 'Tell me what you are looking for and I will reply today.' },
  })

  return [
    {
      install: socials,
      manifest: getModule('social-links')!,
      records: records(socials.id, 'profiles', [
        { network: 'instagram', url: 'https://instagram.com/example', visible: true },
        { network: 'linkedin', url: 'https://linkedin.com/in/example', visible: true },
        { network: 'youtube', url: 'https://youtube.com/@example', visible: true },
        { network: 'facebook', url: 'https://facebook.com/example', visible: true },
      ]),
    },
    {
      install: actions,
      manifest: getModule('action-buttons')!,
      records: records(actions.id, 'actions', [
        { label: 'Call me', icon: 'phone', url: 'https://example.com/call', style: 'primary', visible: true },
        { label: 'Message', icon: 'message', url: 'https://example.com/chat', style: 'primary', visible: true },
        { label: 'Book a viewing', icon: 'calendar', url: 'https://example.com/book', style: 'secondary', visible: true },
        { label: 'Free valuation', icon: 'star', url: 'https://example.com/valuation', style: 'secondary', visible: true },
      ]),
    },
    {
      install: listings,
      manifest: getModule('listings')!,
      records: records(listings.id, 'properties', [
        {
          title: '12 Alder Street',
          address: 'Northside',
          price: 540000,
          status: 'active',
          beds: 3,
          baths: 2,
          area: '1,420 sq ft',
          description: 'Corner lot with a rebuilt kitchen and a garage that actually fits a car.',
          link_url: 'https://example.com/listings/alder',
          visible: true,
        },
        {
          title: '8 Waverly Court',
          address: 'Ridgeway',
          price: 725000,
          status: 'pending',
          beds: 4,
          baths: 3,
          area: '2,100 sq ft',
          description: 'Under offer, but worth a look if the chain moves.',
          visible: true,
        },
        {
          title: '41 Cutler Lane',
          address: 'Northside',
          price: 2400,
          status: 'rental',
          beds: 2,
          baths: 1,
          area: '890 sq ft',
          description: 'Available from the first of next month.',
          visible: true,
        },
      ]),
    },
    {
      install: faq,
      manifest: getModule('faq')!,
      records: records(faq.id, 'entries', [
        {
          question: 'Do you cover areas outside Northside?',
          answer:
            'Yes — Ridgeway and Cutler as well. Anything further out I will refer you to someone I trust rather than pretend I know the street.',
          visible: true,
        },
        {
          question: 'What does a valuation cost?',
          answer: 'Nothing. It takes about forty minutes and there is no obligation afterwards.',
          visible: true,
        },
        {
          question: 'How quickly do you reply?',
          answer: 'Same day, usually within a couple of hours during the week.',
          visible: true,
        },
      ]),
    },
    {
      install: enquiries,
      manifest: getModule('lead-capture')!,
      records: [],
    },
  ]
}
