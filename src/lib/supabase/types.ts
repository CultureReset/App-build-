export type ProfileRow = {
  id: string
  handle: string
  display_name: string
  bio: string
  accent: string
  tagline: string
  avatar_url: string | null
  theme: Record<string, unknown>
  page_published: boolean
  created_at: string
  updated_at: string
}

export type InstallRow = {
  id: string
  owner_id: string
  module_id: string
  module_version: string
  slug: string
  name: string
  config: Record<string, unknown>
  granted_permissions: string[]
  enabled: boolean
  public_enabled: boolean
  public_position: number
  public_read_collections: string[]
  public_write_collections: string[]
  accepting_submissions: boolean
  display_variant: string | null
  public_heading: string | null
  created_at: string
  updated_at: string
}

export type RecordRow = {
  id: string
  install_id: string
  owner_id: string
  collection: string
  data: Record<string, unknown>
  position: number
  submitted_by_public: boolean
  created_at: string
  updated_at: string
}

export type PageTemplateRow = {
  id: string
  author_id: string | null
  slug: string
  name: string
  description: string
  category: string
  theme: Record<string, unknown>
  plan: TemplateBlock[]
  is_builtin: boolean
  is_public: boolean
  use_count: number
  created_at: string
  updated_at: string
}

/** One block in a reusable layout: which module, what to call it, how it shows. */
export type TemplateBlock = {
  module_id: string
  name?: string
  display_variant?: string
  heading?: string
}
