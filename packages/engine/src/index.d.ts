// Types for @nextgent/app-engine. The source is plain JavaScript so every
// screen (Vite, Next, Node) can import it without a build step.

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type FieldType =
  | 'text' | 'longtext' | 'number' | 'money' | 'boolean' | 'select'
  | 'date' | 'time' | 'email' | 'phone' | 'url' | 'image' | 'color'

export interface FieldOption { value: string; label: string; icon?: string }

export interface Field {
  key: string
  label: string
  type: FieldType
  required?: boolean
  help?: string
  placeholder?: string
  options?: FieldOption[]
  optionsFrom?: { source: string; label: string; value?: string }
  min?: number
  max?: number
  maxLength?: number
  default?: string | number | boolean
  ownerOnly?: boolean
  readOnly?: boolean
}

export interface Source {
  from: 'app' | 'business'
  table?: string
  section?: string
  resource?: string
  label: string
  labelSingular: string
  fields: Field[]
  title: string
  subtitle?: string
  group?: string
  order?: string
  sortable?: boolean
  visibleWhen?: string
  limit?: number
}

export type SettingRef = string | { setting: string }

export interface View {
  type: 'collection' | 'settings' | 'list' | 'links' | 'images' | 'details' | 'embed' | 'form' | 'feed' | 'text'
  source?: string
  heading?: string
  style?: string
  fields?: Record<string, string | string[]>
  submitLabel?: string
  intro?: SettingRef
  text?: SettingRef
  openWhen?: { setting: string }
  closedText?: string
  emptyText?: string
}

export interface Manifest {
  schema_version: 1
  id: string
  name: string
  summary?: string
  description?: string
  version: string
  publisher: string
  homepage?: string
  icon?: string
  categories?: string[]
  requires?: { platform?: string; apps?: string[] }
  runtime: { type: 'engine'; engine?: string } | { type: 'hosted'; url: string } | { type: 'service'; base_url: string; health_path?: string }
  surfaces?: { id: string; kind: 'dashboard' | 'settings' | 'public' | 'widget' | 'standalone'; path: string; title?: string; icon?: string; display_modes?: string[]; requires_permission?: string }[]
  permissions?: { id: string; reason: string; optional?: boolean }[]
  capabilities?: { provides?: { id: string; summary?: string; path?: string }[]; consumes?: string[] }
  data?: { namespace: string; delete_on_uninstall?: boolean; tables?: Record<string, { columns: Record<string, { type: string; required?: boolean; default?: Json; max_length?: number }>; public?: 'none' | 'append' | 'read' | 'read-append'; indexes?: string[][] }> }
  events?: { emits?: string[]; subscribes?: { event: string; path: string }[] }
  config?: { key: string; label: string; type: 'text' | 'number' | 'boolean' | 'select' | 'secret' | 'url'; required?: boolean; default?: Json; options?: string[]; help?: string }[]
  pricing?: { model: 'free' | 'flat' | 'usage'; amount?: number; currency?: string; interval?: 'month' | 'year' }
  ui?: { sources: Record<string, Source>; views: Record<string, View[]>; format?: { currency?: SettingRef; locale?: SettingRef } }
}

export interface ValidationError { path: string; message: string }
export interface StoreItemRef { key: string; kind: string; name?: string; publisher?: string }

export declare const SCHEMA_VERSION: 1
export declare const ENGINE_RUNTIME: 'engine'
export declare const PERMISSION: RegExp
export declare const FIELD_TYPES: FieldType[]
export declare const VIEW_TYPES: Record<string, { slots: string[]; multi?: string[]; styles?: string[]; owner?: boolean; writes?: boolean; noSource?: boolean }>
export declare const SURFACE_KINDS: string[]
export declare function validateManifest(input: unknown, options?: { item?: StoreItemRef; semver?: string }): { ok: boolean; errors: ValidationError[]; manifest: Manifest | null }
export declare function parseManifest(input: unknown, options?: { item?: StoreItemRef; semver?: string }): Manifest
export declare function permissionsOf(manifest: Manifest): { required: { id: string; reason: string }[]; optional: { id: string; reason: string }[] }
export declare function resourcesOf(manifest: Manifest): string[]

export declare const SEMVER: RegExp
export declare function prepareVersion(item: StoreItemRef, input: { semver: string; manifest?: object }): { ok: true; manifest: Manifest; permissions: string[] } | { ok: false; error: string }
export declare function permissionIds(list: unknown): string[]
export declare function configKeys(manifest: unknown): string[]

/* blocks */
export type Action =
  | { type: 'record.create'; source: string }
  | { type: 'record.update'; source: string; id: string }
  | { type: 'record.delete'; source: string; id: string }
  | { type: 'record.move'; source: string; id: string; direction: 'up' | 'down' }
  | { type: 'settings.save' }
  | { type: 'form.submit'; source: string }
  | { type: 'view.new'; source: string }
  | { type: 'view.edit'; source: string; id: string }
  | { type: 'view.cancel'; source?: string }

export interface ButtonBlock { type?: 'button'; label: string; icon?: string; note?: string; style?: 'primary' | 'secondary' | 'danger' | 'ghost'; href?: string; action?: Action; disabled?: boolean }
export interface FormField { key: string; label: string; type: FieldType | 'secret'; required?: boolean; help?: string; placeholder?: string; options?: { value: string; label: string }[]; min?: number; max?: number; maxLength?: number }
export interface ListItem { id?: string; title: string; subtitle?: string; body?: string; value?: string; badge?: string; meta?: string[]; image?: { src: string; alt: string }; href?: string; time?: string; actions?: ButtonBlock[] }

export type Block =
  | { type: 'section'; title?: string; blocks: Block[] }
  | { type: 'heading'; text: string; level: 1 | 2 | 3 }
  | { type: 'text' | 'notice' | 'empty'; text: string; tone?: 'default' | 'muted' | 'success' | 'warning' | 'danger' }
  | { type: 'list'; style: 'list' | 'cards' | 'grid' | 'feed'; items: ListItem[] }
  | { type: 'table'; columns: { key: string; label: string }[]; rows: { id: string; cells: Record<string, string>; actions?: ButtonBlock[] }[]; empty?: string }
  | { type: 'image'; src: string; alt: string; caption?: string; href?: string }
  | { type: 'images'; style: 'grid' | 'strip' | 'feature'; items: { src: string; alt: string; caption?: string; href?: string }[] }
  | (ButtonBlock & { type: 'button' })
  | { type: 'buttons'; style: 'stack' | 'inline' | 'grid' | 'icons'; items: ButtonBlock[] }
  | { type: 'form'; id: string; fields: FormField[]; values: Record<string, unknown>; errors?: Record<string, string>; submit: { label: string; action: Action }; cancel?: ButtonBlock; intro?: string; style?: 'feature'; readOnly?: boolean }
  | { type: 'details'; style: 'accordion' | 'list'; items: { summary: string; body: string }[] }
  | { type: 'embed'; src: string; title: string }
  | { type: 'divider' }

export declare const BLOCK_TYPES: Block['type'][]
export declare const ACTION_TYPES: Action['type'][]
export declare const BUTTON_STYLES: string[]
export declare const INPUT_TYPES: string[]
export declare function checkBlocks(blocks: unknown): string[]
export declare function walkBlocks(blocks: Block[]): Generator<Block>

/* renderers */
export type Rows = Record<string, Record<string, unknown>[]>
export interface ActionState {
  granted?: string[]
  settings?: boolean
  editing?: { source: string; id: string | null } | null
  values?: Record<string, Record<string, unknown>>
  errors?: Record<string, Record<string, string>>
  submitted?: Record<string, boolean>
}
export interface EmbedProvider { hosts: string[]; id?: { from: 'query' | 'path'; param?: string }; pattern?: string; src: string }
export interface RenderOptions { copy?: Partial<typeof DEFAULT_COPY>; locale?: string; currency?: string; now?: number; embeds?: EmbedProvider[] }

export declare function renderOwner(manifest: Manifest, settings: Record<string, unknown> | null | undefined, data: Rows | null | undefined, actions?: ActionState, options?: RenderOptions): Block[]
export declare function renderPublic(manifest: Manifest, settings: Record<string, unknown> | null | undefined, data: Rows | null | undefined, actions?: ActionState, options?: RenderOptions): Block[]
export declare function renderSurface(manifest: Manifest, surfaceId: string, settings: Record<string, unknown> | null | undefined, data: Rows | null | undefined, actions?: ActionState, options?: RenderOptions): Block[]
export declare function surfacesOf(manifest: Manifest): { owner: string[]; public: string[]; other: string[] }
export declare function sourcesFor(manifest: Manifest, which?: 'owner' | 'public' | string): string[]
export declare function checkRecord(manifest: Manifest, source: string, values: Record<string, unknown>, options?: { visitor?: boolean; data?: Rows }): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> }
export declare function embedSrc(raw: string, providers?: EmbedProvider[]): string | null

export declare function checkValues(fields: Field[], input: Record<string, unknown>, options?: { visitor?: boolean; lookups?: Record<string, FieldOption[]> }): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> }
export declare function blankValues(fields: Field[]): Record<string, unknown>
export declare function settingsWithDefaults(manifest: Manifest, settings: unknown): Record<string, unknown>
export declare function settingsFields(manifest: Manifest): (Field & { secret?: boolean })[]
export declare function safeHref(raw: unknown): string | null
export declare function safeImage(raw: unknown): string | null
export declare function normaliseUrl(raw: unknown): string | null
export declare function formatValue(field: Field, value: unknown, ctx?: { currency?: string; locale?: string; lookups?: Record<string, FieldOption[]> }): string
export declare function formatMoney(value: unknown, ctx?: { currency?: string; locale?: string }): string
export declare function optionList(field: Field, lookups?: Record<string, FieldOption[]>): FieldOption[]
export declare const DEFAULT_COPY: Record<string, string>

/* data */
export declare class AdapterError extends Error {
  status: number
  body: unknown
  path: string
  errors: Record<string, string> | null
  readonly notConnected: boolean
  readonly forbidden: boolean
}
export declare const DEFAULT_ROUTES: Readonly<Record<'businessSection' | 'businessRow' | 'appTable' | 'appRow' | 'install' | 'installSettings' | 'publicApp' | 'publicSubmit', string>>
export declare const EXISTING_ROUTES: readonly string[]

export interface LoadResult { settings: Record<string, unknown>; granted?: string[]; data: Rows; errors: Record<string, AdapterError>; installError?: AdapterError | null; manifest?: Manifest }
export interface OwnerAdapter {
  routes: Record<string, string>
  install(): Promise<{ installId: string; itemKey?: string; version?: string; settings?: Record<string, unknown>; granted?: string[] }>
  list(manifest: Manifest, source: string): Promise<Record<string, unknown>[]>
  load(manifest: Manifest, which?: string): Promise<LoadResult>
  create(manifest: Manifest, source: string, values: Record<string, unknown>, options?: { rows?: Record<string, unknown>[] }): Promise<Record<string, unknown>>
  update(manifest: Manifest, source: string, id: string, values: Record<string, unknown>): Promise<Record<string, unknown>>
  remove(manifest: Manifest, source: string, id: string): Promise<true>
  move(manifest: Manifest, source: string, rows: Record<string, unknown>[], id: string, direction: 'up' | 'down'): Promise<boolean>
  saveSettings(manifest: Manifest, values: Record<string, unknown>): Promise<Record<string, unknown>>
}
export interface PublicAdapter {
  routes: Record<string, string>
  load(): Promise<LoadResult>
  submit(manifest: Manifest, source: string, values: Record<string, unknown>): Promise<Record<string, unknown>>
}
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>
export declare function createGcrAdapter(config: { baseUrl: string; getToken: (o: { force: boolean }) => Promise<string>; fetch?: FetchLike; routes?: Partial<typeof DEFAULT_ROUTES>; timeoutMs?: number }): OwnerAdapter
export declare function createPublicAdapter(config: { baseUrl: string; installId: string; fetch?: FetchLike; routes?: Partial<typeof DEFAULT_ROUTES>; timeoutMs?: number }): PublicAdapter

/* store */
export declare const APP_KIND: 'app'
export interface StorePublication {
  item: { key: string; kind: string; name: string; summary?: string; description?: string; iconUrl?: string }
  version: { version: string; channel?: string; advisoryType?: string; required?: boolean; changelog?: string; payload: { nextgent: { kind: 'app'; permissions: { permission: string; reason: string }[] }; app: Manifest } }
}
export declare function toStorePublication(manifest: unknown, release?: { kind?: string; channel?: string; advisoryType?: string; required?: boolean; changelog?: string }): ({ ok: true } & StorePublication) | { ok: false; errors: ValidationError[] }
export declare function publishToStore(publication: StorePublication, target: { baseUrl: string; fetch?: FetchLike; headers?: Record<string, string>; credentials?: 'include' | 'same-origin' | 'omit' }): Promise<{ item: { id: string; key: string }; release: unknown }>

/* html */
export declare function renderHtml(blocks: Block[], options?: { prefix?: string; headingBase?: number; formAction?: (action: Action, form: Block) => string | null }): string
export declare function escapeHtml(value: unknown): string
