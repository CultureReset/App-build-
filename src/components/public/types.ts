import type {
  DisplayVariant,
  ModuleCollection,
  ModuleManifest,
  PublicSurface,
} from '@/lib/modules/spec'
import type { InstallRow, RecordRow } from '@/lib/supabase/types'

/** Everything a public template is handed. Templates receive data, never code. */
export type TemplateProps = {
  install: InstallRow
  manifest: ModuleManifest
  surface: PublicSurface
  collection: ModuleCollection
  records: RecordRow[]
  variant: DisplayVariant
  currency: string
}
