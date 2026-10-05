'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CONTRACTS } from '@nextgent/app-engine'
import FieldEditor from '@/components/build/FieldEditor'
import ManifestPanel from '@/components/build/ManifestPanel'
import { blankField, keyFrom } from '@/lib/modules/field-key'
import { createVersion, deleteModule, saveModule, setModuleVisibility } from '@/app/dashboard/build/actions'
import { deriveManifest, validateDraft, type ModuleDraft } from '@/lib/modules/derive'
import { TEMPLATE_INFO, TEMPLATE_ORDER } from '@/lib/modules/templates'
import {
  PERMISSION_COPY,
  TEMPLATE_VARIANTS,
  VARIANT_LABELS,
  type ModuleField,
  type ModuleManifest,
  type PublicTemplate,
} from '@/lib/modules/spec'

const CATEGORIES = ['hospitality', 'events', 'commerce', 'content', 'operations', 'personal'] as const

type Visibility = 'private' | 'unlisted' | 'public'

/**
 * The app builder.
 *
 * Everything a module is — its data, its screens, its public face — is defined
 * here and stored as a validated definition. No code is written, generated or
 * deployed, which is why an app built by a stranger is safe to install.
 */
export default function ModuleBuilder({
  listingId,
  initial,
  visibility,
  installCount = 0,
  published = false,
  storeMode = false,
  reservedPublishers = [],
}: {
  /** The module_listings row being edited (retired platform). Absent in store mode. */
  listingId?: string
  initial: ModuleDraft
  visibility?: Visibility
  installCount?: number
  published?: boolean
  /**
   * The builder without App-build-'s own store: nothing is saved here; the
   * sidebar turns the draft into an engine manifest to download or publish
   * into the Paperclip store (ManifestPanel).
   */
  storeMode?: boolean
  /** The shipped apps' publishers (from apps/), which a builder app may not use (DECISIONS #43). */
  reservedPublishers?: string[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<ModuleDraft>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  // There is one collection in the builder; the spec supports more, and the
  // runtime renders them, but a second one has no UI yet.
  const collectionKey = Object.keys(draft.collections)[0]
  const collection = draft.collections[collectionKey]
  const fields = collection.fields

  const validation = useMemo(() => validateDraft(draft), [draft])
  const derived = useMemo(() => deriveManifest(draft) as ModuleManifest, [draft])
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  function set<K extends keyof ModuleDraft>(key: K, value: ModuleDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function setCollection(next: Partial<typeof collection>) {
    setDraft((current) => ({
      ...current,
      collections: { ...current.collections, [collectionKey]: { ...collection, ...next } },
    }))
    setSaved(false)
  }

  /**
   * Where the entries live: in the app's own table, or in the business under a
   * data contract (DECISIONS #45). Picking a contract adds a binding keyed by
   * the contract name and points the collection at it; "this app" removes it.
   */
  function setSource(contract: string) {
    setDraft((current) => {
      const col = current.collections[collectionKey]
      const bindings = { ...(current.bindings ?? {}) }
      if (col.binding) delete bindings[col.binding]
      const rest = { ...col }
      delete rest.binding
      if (!contract) {
        return { ...current, bindings: Object.keys(bindings).length ? bindings : undefined, collections: { ...current.collections, [collectionKey]: rest } }
      }
      const key = contract.replace(/[^a-z0-9]+/g, '_')
      bindings[key] = { contract, access: 'read-write' }
      return { ...current, bindings, collections: { ...current.collections, [collectionKey]: { ...rest, binding: key } } }
    })
    setSaved(false)
  }

  function setBindingAccess(access: 'read' | 'read-write') {
    const key = collection.binding
    if (!key) return
    setDraft((current) => ({ ...current, bindings: { ...(current.bindings ?? {}), [key]: { ...current.bindings![key], access } } }))
    setSaved(false)
  }

  function setFields(next: ModuleField[]) {
    const keys = next.map((field) => field.key)
    const patch: Partial<typeof collection> = { fields: next }

    // Keep the collection's field references pointing at fields that exist.
    if (!keys.includes(collection.titleField)) {
      patch.titleField = keys[0]
    }
    if (collection.subtitleField && !keys.includes(collection.subtitleField)) {
      patch.subtitleField = undefined
    }
    if (collection.groupField && !keys.includes(collection.groupField)) {
      patch.groupField = undefined
    }

    setCollection(patch)

    // And keep the public surface's slots valid too.
    if (draft.publicSurface) {
      const surface = { ...draft.publicSurface }
      let changed = false

      for (const slot of ['imageField', 'priceField', 'badgeField', 'linkField', 'bodyField'] as const) {
        if (surface[slot] && !keys.includes(surface[slot]!)) {
          surface[slot] = undefined
          changed = true
        }
      }

      if (surface.metaFields?.some((key) => !keys.includes(key))) {
        surface.metaFields = surface.metaFields.filter((key) => keys.includes(key))
        changed = true
      }

      if (changed) {
        setDraft((current) => ({ ...current, publicSurface: surface }))
      }
    }
  }

  function save() {
    startTransition(async () => {
      setError(null)
      if (!listingId) return
      const result = await saveModule(listingId, draft)

      if (result.error) {
        setError(result.error)
        return
      }

      setSaved(true)
      router.refresh()
    })
  }

  const template = draft.publicSurface?.template
  const info = template ? TEMPLATE_INFO[template] : null
  const fieldOptions = fields.map((field) => ({ value: field.key, label: field.label }))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        {/* ---------------- Identity ---------------- */}
        <section className="card space-y-4 p-5">
          <h2 className="font-medium">What is it?</h2>

          <div className="grid gap-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
            <div>
              <label className="label" htmlFor="icon">
                Icon
              </label>
              <input
                id="icon"
                className="field text-center text-xl"
                value={draft.icon}
                maxLength={8}
                onChange={(event) => set('icon', event.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className="field"
                value={draft.name}
                maxLength={48}
                onChange={(event) => set('name', event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="tagline">
              One-line summary
            </label>
            <input
              id="tagline"
              className="field"
              value={draft.tagline}
              maxLength={90}
              onChange={(event) => set('tagline', event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="field min-h-[90px] resize-y"
              value={draft.description}
              maxLength={600}
              onChange={(event) => set('description', event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Category and accent belong to the retired store's listing; the
                engine manifest does not carry them. */}
            {storeMode ? null : (
            <div>
              <label className="label" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                className="field"
                value={draft.category}
                onChange={(event) => set('category', event.target.value as ModuleDraft['category'])}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            )}

            {storeMode ? null : (
            <div>
              <span className="label">Accent</span>
              <input
                type="color"
                className="h-9 w-14 cursor-pointer rounded border border-ink-200 bg-white p-1"
                value={draft.accent}
                aria-label="Accent colour"
                onChange={(event) => set('accent', event.target.value)}
              />
            </div>
            )}

            <div>
              <label className="label" htmlFor="version">
                Version
              </label>
              <input
                id="version"
                className="field font-mono"
                value={draft.version}
                disabled={published}
                onChange={(event) => set('version', event.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------------- Data ---------------- */}
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-medium">What does it store?</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              Each field below becomes a real input, with real validation, on every screen this app
              has.
            </p>
          </div>

          {storeMode ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="collection-source">
                  Where do the entries live?
                </label>
                <select
                  id="collection-source"
                  className="field font-mono"
                  value={collection.binding ? draft.bindings?.[collection.binding]?.contract ?? '' : ''}
                  onChange={(event) => setSource(event.target.value)}
                >
                  <option value="">In this app (its own table)</option>
                  {CONTRACTS.map((contract) => (
                    <option key={contract} value={contract}>
                      {contract}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink-500">
                  A contract names data the business already keeps; the app shows that, and asks for the permission it implies.
                </p>
              </div>
              {collection.binding ? (
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    checked={draft.bindings?.[collection.binding]?.access === 'read-write'}
                    onChange={(event) => setBindingAccess(event.target.checked ? 'read-write' : 'read')}
                  />
                  <span>The app may also edit them</span>
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="collection-label">
                What are the entries called? (plural)
              </label>
              <input
                id="collection-label"
                className="field"
                value={collection.label}
                maxLength={60}
                onChange={(event) => setCollection({ label: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="collection-singular">
                And one of them?
              </label>
              <input
                id="collection-singular"
                className="field"
                value={collection.labelSingular}
                maxLength={60}
                onChange={(event) => setCollection({ labelSingular: event.target.value })}
              />
            </div>
          </div>

          <ul className="space-y-2">
            {fields.map((field, index) => (
              <FieldEditor
                key={field.key}
                field={field}
                index={index}
                count={fields.length}
                onChange={(next) => {
                  const copy = [...fields]
                  copy[index] = next
                  setFields(copy)
                }}
                onRemove={() => setFields(fields.filter((_, i) => i !== index))}
                onMove={(direction) => {
                  const target = direction === 'up' ? index - 1 : index + 1
                  if (target < 0 || target >= fields.length) return
                  const copy = [...fields]
                  const [moved] = copy.splice(index, 1)
                  copy.splice(target, 0, moved)
                  setFields(copy)
                }}
              />
            ))}
          </ul>

          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() =>
              setFields([
                ...fields,
                blankField(
                  `Field ${fields.length + 1}`,
                  fields.map((field) => field.key),
                ),
              ])
            }
          >
            Add a field
          </button>

          <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="title-field">
                Main label
              </label>
              <select
                id="title-field"
                className="field"
                value={collection.titleField}
                onChange={(event) => setCollection({ titleField: event.target.value })}
              >
                {fieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="subtitle-field">
                Secondary label
              </label>
              <select
                id="subtitle-field"
                className="field"
                value={collection.subtitleField ?? ''}
                onChange={(event) =>
                  setCollection({ subtitleField: event.target.value || undefined })
                }
              >
                <option value="">None</option>
                {fieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="group-field">
                Group entries by
              </label>
              <select
                id="group-field"
                className="field"
                value={collection.groupField ?? ''}
                onChange={(event) => setCollection({ groupField: event.target.value || undefined })}
              >
                <option value="">Do not group</option>
                {fields
                  .filter((field) => field.type === 'select')
                  .map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              checked={collection.sortable}
              onChange={(event) => setCollection({ sortable: event.target.checked })}
            />
            <span>Let the owner drag entries into their own order</span>
          </label>
        </section>

        {/* ---------------- Public face ---------------- */}
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-medium">Does the public see it?</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              Some apps are for the business only. Others have a face that goes on the public page.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set('publicSurface', undefined)}
              className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${
                draft.publicSurface
                  ? 'border-ink-200 hover:bg-ink-50'
                  : 'border-brand-500 bg-brand-50'
              }`}
            >
              <span className="font-medium">Behind the scenes</span>
              <span className="mt-0.5 block text-xs text-ink-500">
                Nothing is published. Only the owner sees it.
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                set('publicSurface', {
                  template: 'listings',
                  collection: collectionKey,
                  heading: draft.name,
                  defaultVariant: 'grid',
                })
              }
              className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${
                draft.publicSurface
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-ink-200 hover:bg-ink-50'
              }`}
            >
              <span className="font-medium">Has a public block</span>
              <span className="mt-0.5 block text-xs text-ink-500">
                Appears on the owner&rsquo;s page and gets its own link and QR code.
              </span>
            </button>
          </div>

          {draft.publicSurface && template && info ? (
            <div className="space-y-4 border-t border-ink-100 pt-4">
              <div>
                <span className="label">How should it look?</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TEMPLATE_ORDER.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        const next = TEMPLATE_INFO[option]
                        set('publicSurface', {
                          ...draft.publicSurface!,
                          template: option as PublicTemplate,
                          defaultVariant: TEMPLATE_VARIANTS[option][0],
                          submitCollection: next.collectsSubmissions ? collectionKey : undefined,
                        })
                      }}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        option === template
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-ink-200 hover:bg-ink-50'
                      }`}
                    >
                      <span className="text-sm font-medium">{TEMPLATE_INFO[option].label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-ink-500">
                        {TEMPLATE_INFO[option].description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="label">Default arrangement</span>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIANTS[template].map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() =>
                        set('publicSurface', { ...draft.publicSurface!, defaultVariant: variant })
                      }
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        variant === draft.publicSurface!.defaultVariant
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      {VARIANT_LABELS[variant]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Whoever installs it can switch between these on their own page.
                </p>
              </div>

              {info.slots.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {info.slots.map((slot) =>
                    slot.key === 'metaFields' ? (
                      <div key={slot.key} className="sm:col-span-2">
                        <span className="label">{slot.label}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {fields.map((field) => {
                            const chosen = draft.publicSurface!.metaFields ?? []
                            const on = chosen.includes(field.key)

                            return (
                              <button
                                key={field.key}
                                type="button"
                                onClick={() =>
                                  set('publicSurface', {
                                    ...draft.publicSurface!,
                                    metaFields: on
                                      ? chosen.filter((key) => key !== field.key)
                                      : [...chosen, field.key].slice(0, 4),
                                  })
                                }
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                  on
                                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                                    : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                                }`}
                              >
                                {field.label}
                              </button>
                            )
                          })}
                        </div>
                        <p className="mt-1 text-xs text-ink-500">{slot.help}</p>
                      </div>
                    ) : (
                      <div key={slot.key}>
                        <label className="label" htmlFor={`slot-${slot.key}`}>
                          {slot.label}
                          {slot.required ? <span className="ml-1 text-red-500">*</span> : null}
                        </label>
                        <select
                          id={`slot-${slot.key}`}
                          className="field"
                          value={(draft.publicSurface as Record<string, unknown>)[slot.key] as string ?? ''}
                          onChange={(event) =>
                            set('publicSurface', {
                              ...draft.publicSurface!,
                              [slot.key]: event.target.value || undefined,
                            })
                          }
                        >
                          <option value="">None</option>
                          {fieldOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-ink-500">{slot.help}</p>
                      </div>
                    ),
                  )}
                </div>
              ) : null}

              <div>
                <label className="label" htmlFor="heading">
                  Default section heading
                </label>
                <input
                  id="heading"
                  className="field"
                  value={draft.publicSurface.heading ?? ''}
                  maxLength={80}
                  onChange={(event) =>
                    set('publicSurface', {
                      ...draft.publicSurface!,
                      heading: event.target.value || undefined,
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* ---------------- Sidebar ---------------- */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="card p-4">
          <h2 className="text-sm font-medium">What this app can do</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Worked out from what you built, and shown to anyone before they install it.
          </p>
          <ul className="mt-3 space-y-1.5">
            {derived.permissions?.map((permission) => (
              <li key={permission} className="flex gap-2 text-xs text-ink-600">
                <span aria-hidden className="text-ink-400">
                  •
                </span>
                <span>{PERMISSION_COPY[permission]}</span>
              </li>
            ))}
          </ul>
        </section>

        {!validation.success ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-900">Not ready yet</p>
            <ul className="mt-1.5 space-y-1">
              {validation.error.issues.slice(0, 4).map((issue, index) => (
                <li key={index} className="text-xs text-amber-800">
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {storeMode ? <ManifestPanel draft={draft} ready={validation.success} reservedPublishers={reservedPublishers} /> : null}

        {storeMode || !listingId ? null : (
        <>
        <button
          type="button"
          className="btn-primary w-full"
          onClick={save}
          disabled={pending || !dirty || !validation.success}
        >
          {pending ? 'Saving…' : dirty ? 'Save' : saved ? 'Saved' : 'No changes'}
        </button>

        <section className="card space-y-3 p-4">
          <div>
            <h2 className="text-sm font-medium">Who can install it?</h2>
            {installCount > 0 ? (
              <p className="mt-0.5 text-xs text-ink-500">
                {installCount} {installCount === 1 ? 'install' : 'installs'} so far. They keep
                running on the version they installed.
              </p>
            ) : null}
          </div>

          {(
            [
              ['private', 'Only me', 'A draft nobody else can see.'],
              ['unlisted', 'Anyone with the link', 'Not in the store, but installable.'],
              ['public', 'Everyone', 'Listed in the store for anyone to install.'],
            ] as const
          ).map(([value, label, help]) => (
            <button
              key={value}
              type="button"
              disabled={pending || !validation.success}
              onClick={() =>
                startTransition(async () => {
                  setError(null)
                  const result = await setModuleVisibility(listingId!, value)
                  if (result.error) setError(result.error)
                  router.refresh()
                })
              }
              className={`w-full rounded-lg border p-2.5 text-left transition-colors disabled:opacity-50 ${
                value === visibility ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
              }`}
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="mt-0.5 block text-xs text-ink-500">{help}</span>
            </button>
          ))}
        </section>

        {published ? (
          <section className="card p-4">
            <h2 className="text-sm font-medium">Published version</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              A published version is frozen so what people installed stays what they installed.
              Changes go into a new version they choose to move to.
            </p>
            <button
              type="button"
              className="btn-secondary mt-3 w-full text-sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await createVersion(listingId!)
                  if (result.error) {
                    setError(result.error)
                    return
                  }
                  if (result.id) router.push(`/dashboard/build/${result.id}`)
                })
              }
            >
              Start a new version
            </button>
          </section>
        ) : null}

        <section className="card p-4">
          <h2 className="text-sm font-medium">Delete</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Removes it from the store. Anyone who already installed it keeps a working copy.
          </p>

          {confirmDelete ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-danger text-xs"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteModule(listingId!)
                    if (result.error) {
                      setError(result.error)
                      return
                    }
                    router.push('/dashboard/build')
                  })
                }
              >
                Delete permanently
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-danger mt-3 text-xs"
              onClick={() => setConfirmDelete(true)}
            >
              Delete this app
            </button>
          )}
        </section>
        </>
        )}
      </aside>
    </div>
  )
}
