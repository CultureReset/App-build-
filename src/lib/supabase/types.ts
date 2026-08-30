export type ProfileRow = {
  id: string
  handle: string
  display_name: string
  bio: string
  accent: string
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
