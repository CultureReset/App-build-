import { z } from 'zod'
import { getPreset, themeSchema, type Theme } from '@/lib/theme/spec'
import { displayVariantSchema } from '@/lib/modules/spec'

/**
 * A layout is a theme plus an ordered plan of blocks. It carries no data —
 * only the shape of a page.
 *
 * This is what makes a design reusable across the ecosystem: publish the
 * layout you built, and anyone can apply it to their own account, getting the
 * same look and the same set of apps installed in the same order, filled with
 * their own content.
 */
export const templateBlockSchema = z.object({
  module_id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(80).optional(),
  heading: z.string().max(80).optional(),
  display_variant: displayVariantSchema.optional(),
})

export type TemplateBlock = z.infer<typeof templateBlockSchema>

export const templatePlanSchema = z.array(templateBlockSchema).max(24)

export const pageTemplateSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(49)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use a lowercase, dash-separated name.'),
  name: z.string().min(1).max(60),
  description: z.string().max(300).default(''),
  category: z
    .enum(['general', 'hospitality', 'events', 'commerce', 'content', 'operations', 'personal'])
    .default('general'),
  theme: themeSchema,
  plan: templatePlanSchema,
})

export type PageTemplate = z.infer<typeof pageTemplateSchema>

function preset(id: string): Theme {
  const found = getPreset(id)

  if (!found) {
    throw new Error(`Unknown theme preset "${id}".`)
  }

  return found.theme
}

/**
 * Layouts that ship with the platform. User-published layouts live in the
 * `page_templates` table and pass through the exact same schema.
 */
export const BUILTIN_TEMPLATES: PageTemplate[] = [
  {
    slug: 'real-estate-agent',
    name: 'Real Estate Agent',
    description:
      'Profile, one-tap contact, live listings, an intro video and an enquiry form. Built for turning property interest into a conversation.',
    category: 'commerce',
    theme: preset('agent'),
    plan: [
      { module_id: 'social-links', heading: '', display_variant: 'icons' },
      { module_id: 'action-buttons', name: 'Contact me', heading: '', display_variant: 'grid' },
      { module_id: 'listings', name: 'My listings', heading: 'Listings', display_variant: 'grid' },
      { module_id: 'video', name: 'About me', heading: 'About me', display_variant: 'feature' },
      { module_id: 'lead-capture', name: 'Enquiries', heading: 'Get in touch', display_variant: 'feature' },
      { module_id: 'faq', name: 'FAQ', heading: 'Common questions', display_variant: 'accordion' },
    ],
  },
  {
    slug: 'restaurant',
    name: 'Restaurant or Café',
    description:
      'A scannable menu, a photo gallery, booking and directions buttons, and your socials.',
    category: 'hospitality',
    theme: preset('warm'),
    plan: [
      { module_id: 'action-buttons', name: 'Quick actions', heading: '', display_variant: 'grid' },
      { module_id: 'qr-menu', name: 'Menu', heading: 'Menu', display_variant: 'list' },
      { module_id: 'gallery', name: 'Photos', heading: 'The room', display_variant: 'strip' },
      { module_id: 'social-links', heading: '', display_variant: 'icons' },
    ],
  },
  {
    slug: 'dj-night',
    name: 'DJ & Nightlife',
    description: 'Take requests from the floor, push your socials, show the gallery.',
    category: 'events',
    theme: preset('neon'),
    plan: [
      { module_id: 'song-request', name: 'Requests', heading: 'Request a song', display_variant: 'feature' },
      { module_id: 'action-buttons', name: 'Links', heading: '', display_variant: 'buttons' },
      { module_id: 'gallery', name: 'Gallery', heading: 'Recent nights', display_variant: 'grid' },
      { module_id: 'social-links', heading: '', display_variant: 'icons' },
    ],
  },
  {
    slug: 'creator',
    name: 'Creator',
    description: 'A clean link page with socials, a featured video and a gallery.',
    category: 'personal',
    theme: preset('clean'),
    plan: [
      { module_id: 'social-links', heading: '', display_variant: 'icons' },
      { module_id: 'link-hub', name: 'Links', heading: '', display_variant: 'buttons' },
      { module_id: 'video', name: 'Latest', heading: 'Latest', display_variant: 'feature' },
      { module_id: 'gallery', name: 'Work', heading: 'Work', display_variant: 'grid' },
    ],
  },
  {
    slug: 'trades-services',
    name: 'Trades & Services',
    description:
      'Show the work, answer the usual questions, and make quoting one tap away.',
    category: 'operations',
    theme: preset('brutal'),
    plan: [
      { module_id: 'action-buttons', name: 'Contact', heading: '', display_variant: 'buttons' },
      { module_id: 'gallery', name: 'Recent work', heading: 'Recent work', display_variant: 'grid' },
      { module_id: 'faq', name: 'FAQ', heading: 'Questions', display_variant: 'accordion' },
      { module_id: 'lead-capture', name: 'Quote requests', heading: 'Request a quote', display_variant: 'feature' },
    ],
  },
  {
    slug: 'dark-hub',
    name: 'Dark Hub',
    description: 'High-contrast dark page. Works for anything — start here and swap the blocks.',
    category: 'general',
    theme: preset('midnight'),
    plan: [
      { module_id: 'social-links', heading: '', display_variant: 'icons' },
      { module_id: 'action-buttons', name: 'Actions', heading: '', display_variant: 'grid' },
      { module_id: 'link-hub', name: 'Links', heading: 'Links', display_variant: 'list' },
    ],
  },
]

/** Every built-in is validated at load, exactly like a module manifest. */
for (const template of BUILTIN_TEMPLATES) {
  pageTemplateSchema.parse(template)
}

export function getBuiltinTemplate(slug: string): PageTemplate | undefined {
  return BUILTIN_TEMPLATES.find((template) => template.slug === slug)
}
