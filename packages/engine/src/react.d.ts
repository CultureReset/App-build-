import type { ReactElement } from 'react'
import type { Action, Block, Manifest, OwnerAdapter, PublicAdapter, RenderOptions } from './index'

export declare function Blocks(props: {
  blocks: Block[]
  onAction?: (action: Action, values: Record<string, unknown> | undefined, block: Block) => void
  busy?: boolean
  prefix?: string
  className?: string
  /** image fields also take a file; the screen's onAction uploads it (OwnerAdapter.uploadValues) */
  upload?: boolean
}): ReactElement

export declare function EngineApp(props: {
  manifest: Manifest
  surface?: 'owner' | 'public' | string
  adapter: OwnerAdapter | (PublicAdapter & Partial<OwnerAdapter>)
  options?: RenderOptions
  prefix?: string
  onError?: (err: Error) => void
}): ReactElement
