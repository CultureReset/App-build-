import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHourlyLimiter } from '../src/lib/ai/builder-limit.ts'

/**
 * The store-mode builder's per-client limit (src/app/build/ai-actions.ts).
 * It is the only thing between an anonymous visitor and the deployment's AI
 * spend, so its memory must stay bounded whatever keys arrive.
 */

function clock(start = 0) {
  let now = start
  return { now: () => now, tick: (ms: number) => (now += ms) }
}

test('allows up to the limit per key per hour, then refuses until the window passes', () => {
  const c = clock()
  const limiter = createHourlyLimiter({ limit: () => 2, maxKeys: 10, now: c.now })
  assert.equal(limiter.allow('a'), true)
  assert.equal(limiter.allow('a'), true)
  assert.equal(limiter.allow('a'), false)
  assert.equal(limiter.allow('b'), true, 'another key has its own allowance')
  c.tick(60 * 60 * 1000)
  assert.equal(limiter.allow('a'), true, 'an hour later the key is fresh')
})

test('the number of keys held never exceeds maxKeys, however many distinct keys arrive', () => {
  const c = clock()
  const limiter = createHourlyLimiter({ limit: () => 5, maxKeys: 100, now: c.now })
  for (let i = 0; i < 10_000; i++) limiter.allow(`spoofed-${i}`)
  assert.ok(limiter.size <= 100, `held ${limiter.size} keys`)
})

test('expired keys are dropped before live ones are evicted', () => {
  const c = clock()
  const limiter = createHourlyLimiter({ limit: () => 1, maxKeys: 3, now: c.now })
  limiter.allow('old-1')
  limiter.allow('old-2')
  c.tick(60 * 60 * 1000 + 1)
  limiter.allow('live')
  assert.equal(limiter.allow('live'), false, 'still counted')
  limiter.allow('new-1')
  limiter.allow('new-2')
  assert.ok(limiter.size <= 3)
  assert.equal(limiter.allow('live'), false, 'the live key survived the sweep; the expired ones went first')
})

test('a changed limit applies on the next call', () => {
  let limit = 1
  const limiter = createHourlyLimiter({ limit: () => limit, maxKeys: 10, now: () => 0 })
  assert.equal(limiter.allow('a'), true)
  assert.equal(limiter.allow('a'), false)
  limit = 3
  assert.equal(limiter.allow('a'), true)
})
