'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// The account's Ghost box, reached from anywhere through the relay in
// gcr-api-clean. This app never talks to the box directly: a command is
// queued at the API with the signed-in session, the box pulls it over its own
// outbound link, serves it locally and posts the answer back; this panel polls
// for that answer. The box's data never leaves the business.
//
// Requirements: this app and gcr-api-clean must share one Supabase project
// (the same login), and the account must own a business there (entity_owners),
// which is what the API scopes every request to.

const API = (process.env.NEXT_PUBLIC_GCR_API_BASE ?? '').replace(/\/$/, '')
const POLL_MS = 1500
const POLL_FOR_MS = 60000

type Node = {
  id: string
  name: string
  version: string | null
  health: { core?: string } | null
  last_seen_at: string | null
  revoked_at: string | null
}
type Answer = { status: string; response_status: number | null; response_body: any }
type LogEntry = { asked: string; answer?: Answer; error?: string }

function online(node: Node) {
  return !!node.last_seen_at && Date.now() - new Date(node.last_seen_at).getTime() < 3 * 60 * 1000
}

export default function GhostPanel() {
  const [nodes, setNodes] = useState<Node[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [enrolled, setEnrolled] = useState<{ node: Node; token: string } | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState<LogEntry[]>([])
  const [boxName, setBoxName] = useState('')
  const [phrases, setPhrases] = useState<string[]>([]) // from the box's own map catalog

  const call = useCallback(async (method: 'GET' | 'POST', path: string, body?: unknown) => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not signed in.')
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 403) throw new Error('This account is not linked to a business yet.')
      if (response.status === 501) throw new Error('Ghost boxes are not set up on the server yet.')
      throw new Error(json.error || `${response.status}`)
    }
    return json
  }, [])

  const load = useCallback(async () => {
    try {
      const { nodes: list } = await call('GET', '/api/nodes')
      setNodes(list)
      setSelected((cur) => cur || list.find((n: Node) => !n.revoked_at)?.id || null)
      setError('')
    } catch (err) {
      setError((err as Error).message)
      setNodes([])
    }
  }, [call])

  useEffect(() => {
    if (!API) {
      setError('NEXT_PUBLIC_GCR_API_BASE is not set.')
      setNodes([])
      return
    }
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  async function ask(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Answer> {
    const { request } = await call('POST', `/api/nodes/${selected}/requests`, { method, path, body })
    const deadline = Date.now() + POLL_FOR_MS
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS))
      const { request: latest } = await call('GET', `/api/nodes/${selected}/requests/${request.id}`)
      if (latest.status === 'done' || latest.status === 'failed') return latest
    }
    throw new Error('The box did not answer in time. Is it on and linked?')
  }

  async function enrol() {
    setBusy(true)
    try {
      setEnrolled(await call('POST', '/api/nodes', boxName.trim() ? { name: boxName.trim() } : {}))
      setBoxName('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selected) return
    const asked = text.trim()
    setText('')
    setBusy(true)
    try {
      const answer = await ask('POST', '/intent', { text: asked })
      setLog((l) => [{ asked, answer }, ...l].slice(0, 20))
    } catch (err) {
      setLog((l) => [{ asked, error: (err as Error).message }, ...l].slice(0, 20))
    } finally {
      setBusy(false)
    }
  }

  const node = nodes?.find((n) => n.id === selected)
  const nodeOnline = !!node && online(node)

  // What this box can do comes from the box itself, never from this screen.
  useEffect(() => {
    setPhrases([])
    if (!selected || !nodeOnline) return
    let cancelled = false
    ask('GET', '/capabilities')
      .then((answer) => {
        const byCapability: Record<string, string[]> = answer.response_body?.phrases ?? {}
        if (!cancelled) setPhrases(Object.values(byCapability).flat())
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selected, nodeOnline])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Ghost</h1>
        <p className="text-sm text-ink-500">
          Your box at the business. Tell it what to do from anywhere; your data stays there.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {enrolled && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <h2 className="font-medium">Box enrolled: {enrolled.node.name}</h2>
          <p className="mt-1 text-sm text-ink-600">
            Put this token in <code>~/.config/ghost/ghost.env</code> on the box as{' '}
            <code>NEXTGENT_NODE_TOKEN</code>, then run <code>ghost install</code>. It is shown once.
          </p>
          <pre className="mt-2 select-all break-all rounded-lg bg-ink-100 p-3 text-xs">{enrolled.token}</pre>
          <button className="btn-ghost mt-2 text-sm" onClick={() => setEnrolled(null)}>
            I saved it
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(nodes ?? []).map((n) => (
          <button
            key={n.id}
            disabled={!!n.revoked_at}
            onClick={() => setSelected(n.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              n.id === selected ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white'
            }`}
          >
            {n.name} · {n.revoked_at ? 'revoked' : online(n) ? 'online' : 'offline'}
          </button>
        ))}
        <input
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
          value={boxName}
          onChange={(e) => setBoxName(e.target.value)}
          placeholder="Name the box (optional)"
          maxLength={80}
        />
        <button className="btn-ghost text-sm" onClick={enrol} disabled={busy}>
          + Enrol a box
        </button>
      </div>

      {node && (
        <>
          <p className="text-sm text-ink-500">
            version {node.version ?? '—'} · core {node.health?.core ?? 'unknown'}
          </p>
          <form onSubmit={send} className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={phrases.length ? `Try "${phrases[0]}"` : 'Tell your box what to do'}
              disabled={busy || !online(node)}
            />
            <button
              type="submit"
              className="rounded-lg bg-ink-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={busy || !text.trim() || !online(node)}
            >
              {busy ? 'Working…' : 'Send'}
            </button>
          </form>
          {phrases.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
              It understands:
              {phrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  className="rounded-full border border-ink-200 px-2 py-0.5"
                  onClick={() => setText(phrase)}
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}
          <ul className="space-y-2">
            {log.map((entry, i) => (
              <li key={i} className="rounded-lg bg-white p-3 text-sm ring-1 ring-ink-200">
                <div>
                  <span className="font-medium">You:</span> {entry.asked}
                </div>
                {entry.error ? <div className="text-red-700">{entry.error}</div> : <AnswerLine answer={entry.answer!} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function AnswerLine({ answer }: { answer: Answer }) {
  const body = answer.response_body ?? {}
  if (answer.response_status !== 200) {
    return <div className="text-red-700">Box replied {answer.response_status}: {body.error ?? JSON.stringify(body)}</div>
  }
  if (body.resolved === false) {
    const known = Object.values<string[]>(body.known_phrases ?? {}).flat()
    return (
      <div className="text-ink-600">
        The box did not understand that.{known.length ? ` It understands: ${known.join(' · ')}` : ''}
      </div>
    )
  }
  return (
    <div className="text-ink-600">
      {body.capability} → {body.action?.status}
      {body.approval ? ` (reply YES ${body.approval.ref} on your phone)` : ''}
      {body.receipt ? ` · Verified: ${body.receipt.result}` : ''}
      {body.error ? ` · ${body.error}` : ''}
    </div>
  )
}
