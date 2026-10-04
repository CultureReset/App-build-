'use client'

import { useMemo, useState } from 'react'
import { publishToStore, toStorePublication, validateManifest, type Manifest } from '@nextgent/app-engine'
import { engineManifestFromModule } from '@/lib/engine/from-module'
import { deriveManifest, type ModuleDraft } from '@/lib/modules/derive'
import type { ModuleManifest } from '@/lib/modules/spec'

/**
 * What the builder produces now: an engine manifest (app-manifest v1 + ui)
 * for the Paperclip store. It can be downloaded, or published straight into
 * the store by an instance admin whose Paperclip session this browser holds
 * (Paperclip must list this site in PAPERCLIP_APP_ORIGINS). Nothing is saved
 * in App-build- and no credential is kept here.
 */
const STORE_URL = process.env.NEXT_PUBLIC_PAPERCLIP_URL ?? ''
const STORE_KIND = process.env.NEXT_PUBLIC_STORE_APP_KIND || undefined

export default function ManifestPanel({ draft, ready }: { draft: ModuleDraft; ready: boolean }) {
  const [publisher, setPublisher] = useState(process.env.NEXT_PUBLIC_STORE_PUBLISHER ?? '')
  const [changelog, setChangelog] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const manifest = useMemo<Manifest | null>(() => {
    if (!ready || !publisher.trim()) return null
    return engineManifestFromModule(deriveManifest(draft) as ModuleManifest, { publisher })
  }, [draft, ready, publisher])

  const checked = useMemo(() => (manifest ? validateManifest(manifest) : null), [manifest])
  const json = manifest ? JSON.stringify(manifest, null, 2) : ''

  function download() {
    if (!manifest) return
    const url = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${manifest.id}-${manifest.version}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function publish() {
    if (!manifest) return
    const publication = toStorePublication(manifest, { kind: STORE_KIND, changelog: changelog.trim() || undefined })
    if (!publication.ok) {
      setStatus({ ok: false, text: publication.errors[0]?.message ?? 'Not a valid manifest.' })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      await publishToStore(publication, { baseUrl: STORE_URL, credentials: 'include' })
      setStatus({ ok: true, text: `Published ${manifest.id} ${manifest.version} to the store.` })
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-sm font-medium">Store manifest</h2>
        <p className="mt-0.5 text-xs text-ink-500">
          The app as the store and every screen read it. Publishing puts it in the store; owners
          install it from there.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="publisher">
          Publisher id
        </label>
        <input
          id="publisher"
          className="field font-mono"
          value={publisher}
          maxLength={48}
          placeholder="lowercase-with-dashes"
          onChange={(event) => setPublisher(event.target.value)}
        />
      </div>

      {manifest ? <p className="font-mono text-xs text-ink-500">{manifest.id} · {manifest.version}</p> : null}

      {checked && !checked.ok ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
          {checked.errors.slice(0, 4).map((e, i) => (
            <li key={i} className="text-xs text-amber-800">
              {e.path} {e.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <label className="label" htmlFor="changelog">
          What changed (optional)
        </label>
        <textarea id="changelog" className="field min-h-[60px]" value={changelog} maxLength={2000} onChange={(event) => setChangelog(event.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-xs" disabled={!checked?.ok} onClick={download}>
          Download
        </button>
        <button type="button" className="btn-secondary text-xs" disabled={!manifest} onClick={() => setShow((v) => !v)}>
          {show ? 'Hide' : 'Show'} JSON
        </button>
        {STORE_URL ? (
          <button type="button" className="btn-primary text-xs" disabled={!checked?.ok || busy} onClick={publish}>
            {busy ? 'Publishing…' : 'Publish to store'}
          </button>
        ) : null}
      </div>

      {!STORE_URL ? <p className="text-xs text-ink-500">Set NEXT_PUBLIC_PAPERCLIP_URL to publish from here.</p> : null}
      {status ? <p className={`text-xs ${status.ok ? 'text-green-700' : 'text-red-700'}`}>{status.text}</p> : null}
      {show && json ? <pre className="max-h-80 overflow-auto rounded-lg bg-ink-50 p-2 text-[0.65rem] leading-snug">{json}</pre> : null}
    </section>
  )
}
