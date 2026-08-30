import Actions from './templates/Actions'
import Board from './templates/Board'
import Catalog from './templates/Catalog'
import Embed from './templates/Embed'
import Faq from './templates/Faq'
import FormBlock from './templates/FormBlock'
import Gallery from './templates/Gallery'
import Links from './templates/Links'
import Listings from './templates/Listings'
import Socials from './templates/Socials'
import { resolveVariant, type PublicTemplate } from '@/lib/modules/spec'
import type { TemplateProps } from './types'
import type { ModuleManifest } from '@/lib/modules/spec'
import type { InstallRow, RecordRow } from '@/lib/supabase/types'

/**
 * Dispatches an install to the runtime template it declared.
 *
 * The runtime owns every template here. A module chooses one by name and hands
 * over data — it can never inject markup, styles or scripts of its own, which
 * is what makes a page of third-party blocks safe and lets one theme restyle
 * all of them at once.
 */
const TEMPLATES: Record<PublicTemplate, (props: TemplateProps) => React.ReactNode> = {
  actions: Actions,
  board: Board,
  catalog: Catalog,
  embed: Embed,
  faq: Faq,
  form: FormBlock,
  gallery: Gallery,
  links: Links,
  listings: Listings,
  socials: Socials,
}

export default function PublicSurface({
  install,
  manifest,
  records,
}: {
  install: InstallRow
  manifest: ModuleManifest
  records: RecordRow[]
}) {
  const surface = manifest.publicSurface

  if (!surface) {
    return null
  }

  const collection = manifest.collections[surface.collection]

  if (!collection) {
    return null
  }

  const Template = TEMPLATES[surface.template]
  const currency = typeof install.config.currency === 'string' ? install.config.currency : '$'

  return (
    <Template
      install={install}
      manifest={manifest}
      surface={surface}
      collection={collection}
      records={records}
      variant={resolveVariant(surface, install.display_variant)}
      currency={currency}
    />
  )
}
