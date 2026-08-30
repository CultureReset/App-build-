import ThemedForm from '../ThemedForm'
import { EmptyBlock } from './shared'
import type { TemplateProps } from '../types'

export default function FormBlock({ install, manifest, surface, variant }: TemplateProps) {
  const submitCollection = surface.submitCollection
    ? manifest.collections[surface.submitCollection]
    : undefined

  const intro = typeof install.config.intro === 'string' ? install.config.intro : undefined

  // Both the install flag and the module's own setting can close a form.
  const settingOpen = install.config.accepting !== false
  const open = install.accepting_submissions && settingOpen && submitCollection

  if (!open) {
    return <EmptyBlock label="Closed for now — check back soon." />
  }

  return (
    <ThemedForm
      installId={install.id}
      collection={submitCollection}
      cta={submitCollection.publicWriteCta ?? 'Send'}
      intro={intro}
      framed={variant === 'feature'}
    />
  )
}
