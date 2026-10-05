import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gateConfig, gateDecision, isBuilderPath, resolveOperator } from '../src/lib/paperclip-session.ts'

/**
 * The builder gate (DECISIONS #50): /build* and app generation need a
 * Paperclip instance-admin session. The cookie is forwarded to Paperclip;
 * nothing is decided from the request itself.
 */
function stub(routes: Record<string, { status?: number; body?: unknown }>) {
  const calls: { url: string; cookie: string | undefined }[] = []
  const fetch = async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    calls.push({ url, cookie: headers.Cookie ?? headers.cookie })
    const path = new URL(url).pathname
    const r = routes[path] ?? { status: 404, body: { error: 'not found' } }
    return new Response(JSON.stringify(r.body ?? null), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  }
  return Object.assign(fetch, { calls })
}

const config = gateConfig({ PAPERCLIP_URL: 'https://paperclip.example.test/', PAPERCLIP_LOGIN_URL: 'https://paperclip.example.test/login' })
const session = { session: { id: 's', userId: 'u1' }, user: { id: 'u1', email: 'ana@example.test', name: 'Ana' } }

test('config: the Paperclip address comes from the environment, trailing slash trimmed; the public one is the fallback', () => {
  assert.equal(config.baseUrl, 'https://paperclip.example.test')
  assert.equal(gateConfig({ NEXT_PUBLIC_PAPERCLIP_URL: 'https://pc.example.test' }).baseUrl, 'https://pc.example.test')
  assert.equal(gateConfig({}).baseUrl, null)
  assert.equal(gateConfig({}).loginUrl, null)
})

test('resolveOperator forwards the cookie to get-session, then reads the instance-admin flag', async () => {
  const fetch = stub({ '/api/auth/get-session': { body: session }, '/api/cli-auth/me': { body: { userId: 'u1', isInstanceAdmin: true } } })
  const operator = await resolveOperator({ cookie: 'better-auth.session_token=abc', config, fetch })
  assert.deepEqual(operator, { userId: 'u1', email: 'ana@example.test', name: 'Ana', isInstanceAdmin: true })
  assert.equal(fetch.calls.length, 2)
  assert.ok(fetch.calls.every((c) => c.cookie === 'better-auth.session_token=abc'))
  assert.equal(fetch.calls[0].url, 'https://paperclip.example.test/api/auth/get-session')
})

test('resolveOperator: a member is not an admin; no session, no cookie, no address or a network failure give null', async () => {
  const member = stub({ '/api/auth/get-session': { body: session }, '/api/cli-auth/me': { body: { userId: 'u1', isInstanceAdmin: false } } })
  assert.equal((await resolveOperator({ cookie: 'x=1', config, fetch: member }))?.isInstanceAdmin, false)
  const signedOut = stub({ '/api/auth/get-session': { status: 401, body: { error: 'Board authentication required' } } })
  assert.equal(await resolveOperator({ cookie: 'x=1', config, fetch: signedOut }), null)
  assert.equal(signedOut.calls.length, 1, 'no second call without a session')
  const noCookie = stub({ '/api/auth/get-session': { body: session } })
  assert.equal(await resolveOperator({ cookie: null, config, fetch: noCookie }), null)
  assert.equal(noCookie.calls.length, 0)
  assert.equal(await resolveOperator({ cookie: 'x=1', config: gateConfig({}), fetch: noCookie }), null)
  assert.equal(await resolveOperator({ cookie: 'x=1', config, fetch: async () => { throw new Error('offline') } }), null)
})

test('only /build and what is under it is gated', () => {
  assert.equal(isBuilderPath('/build'), true)
  assert.equal(isBuilderPath('/build/describe'), true)
  assert.equal(isBuilderPath('/builder'), false)
  assert.equal(isBuilderPath('/'), false)
  assert.equal(isBuilderPath('/retired'), false)
})

test('the decision: admins pass; others are sent to log in (a page) or refused (anything else); no address is a 503', () => {
  const admin = { userId: 'u1', email: null, name: null, isInstanceAdmin: true }
  const member = { ...admin, isInstanceAdmin: false }
  assert.deepEqual(gateDecision({ operator: admin, config, html: true, url: 'https://build.example.test/build' }), { kind: 'allow' })
  assert.deepEqual(gateDecision({ operator: null, config, html: true, url: 'https://build.example.test/build/describe' }), { kind: 'redirect', to: 'https://paperclip.example.test/login?next=https%3A%2F%2Fbuild.example.test%2Fbuild%2Fdescribe' })
  assert.deepEqual(gateDecision({ operator: null, config, html: false, url: 'https://build.example.test/build' }), { kind: 'refuse', status: 401 })
  assert.deepEqual(gateDecision({ operator: member, config, html: true, url: 'https://build.example.test/build' }), { kind: 'refuse', status: 403 })
  assert.deepEqual(gateDecision({ operator: null, config: gateConfig({ PAPERCLIP_URL: 'https://pc.example.test' }), html: true, url: 'https://build.example.test/build' }), { kind: 'refuse', status: 401 }, 'no login address: refuse')
  assert.deepEqual(gateDecision({ operator: null, config: gateConfig({}), html: true, url: 'https://build.example.test/build' }), { kind: 'refuse', status: 503 })
})
