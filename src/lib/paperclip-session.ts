/**
 * The builder gate (DECISIONS #50): /build* and app generation are for a
 * Paperclip instance admin. The browser's Paperclip cookie is forwarded to
 * Paperclip, which says who it is (GET /api/auth/get-session: session and
 * user) and whether they administer the instance (GET /api/cli-auth/me:
 * isInstanceAdmin — get-session itself does not carry the flag). Nothing is
 * decided from the request: no header is trusted, no key is kept here.
 *
 * Pure (no Next imports) so src/proxy.ts and app/build/ai-actions.ts share it
 * and tests can stub the two endpoints.
 */

export interface Operator {
  userId: string
  email: string | null
  name: string | null
  isInstanceAdmin: boolean
}

export interface GateConfig {
  /** Paperclip's address (PAPERCLIP_URL, else the browser's NEXT_PUBLIC_PAPERCLIP_URL), no trailing slash. */
  baseUrl: string | null
  /** Where a signed-out person is sent (PAPERCLIP_LOGIN_URL); without it they get a 401. */
  loginUrl: string | null
  sessionPath: string
  accessPath: string
}

export function gateConfig(env: Record<string, string | undefined> = process.env): GateConfig {
  const trim = (v: string | undefined) => (v && v.trim() ? v.trim().replace(/\/+$/, '') : null)
  return {
    baseUrl: trim(env.PAPERCLIP_URL) ?? trim(env.NEXT_PUBLIC_PAPERCLIP_URL),
    loginUrl: trim(env.PAPERCLIP_LOGIN_URL),
    sessionPath: '/api/auth/get-session',
    accessPath: '/api/cli-auth/me',
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** Who holds this cookie, according to Paperclip; null when nobody does (or Paperclip cannot be asked). */
export async function resolveOperator({ cookie, config, fetch: doFetch = globalThis.fetch }: { cookie: string | null | undefined; config: GateConfig; fetch?: FetchLike }): Promise<Operator | null> {
  if (!cookie || !config.baseUrl) return null
  const get = async (path: string): Promise<Record<string, unknown> | null> => {
    try {
      const res = await doFetch(`${config.baseUrl}${path}`, { method: 'GET', headers: { Accept: 'application/json', Cookie: cookie }, redirect: 'manual' })
      if (!res.ok) return null
      const body = (await res.json()) as unknown
      return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  const session = await get(config.sessionPath)
  const user = session?.user as { id?: unknown; email?: unknown; name?: unknown } | undefined
  const userId = typeof user?.id === 'string' ? user.id : typeof (session?.session as { userId?: unknown } | undefined)?.userId === 'string' ? ((session!.session as { userId: string }).userId) : null
  if (!userId) return null
  const access = await get(config.accessPath)
  return {
    userId,
    email: typeof user?.email === 'string' ? user.email : null,
    name: typeof user?.name === 'string' ? user.name : null,
    isInstanceAdmin: access?.isInstanceAdmin === true,
  }
}

export function isBuilderPath(pathname: string): boolean {
  return pathname === '/build' || pathname.startsWith('/build/')
}

export type GateDecision = { kind: 'allow' } | { kind: 'redirect'; to: string } | { kind: 'refuse'; status: 401 | 403 | 503 }

/**
 * An instance admin passes. Nobody signed in: a page request goes to log in
 * when a login address is configured, otherwise 401. Signed in but not an
 * admin: 403. No Paperclip address at all: 503 — the gate cannot open.
 */
export function gateDecision({ operator, config, html, url }: { operator: Operator | null; config: GateConfig; html: boolean; url: string }): GateDecision {
  if (!config.baseUrl) return { kind: 'refuse', status: 503 }
  if (operator?.isInstanceAdmin) return { kind: 'allow' }
  if (operator) return { kind: 'refuse', status: 403 }
  if (html && config.loginUrl) {
    const to = new URL(config.loginUrl)
    to.searchParams.set('next', url)
    return { kind: 'redirect', to: to.toString() }
  }
  return { kind: 'refuse', status: 401 }
}

export const GATE_MESSAGES: Record<401 | 403 | 503, string> = {
  401: 'Sign in to Paperclip to use the app builder.',
  403: 'The app builder is for Paperclip instance admins.',
  503: 'The app builder is not configured: set PAPERCLIP_URL.',
}
