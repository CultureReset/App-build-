/**
 * The store-mode builder's in-memory hourly limit, per client key.
 *
 * Pure (no Next imports) so it can be tested. Two bounds hold its memory:
 * each key keeps only the timestamps inside the current window (at most
 * `limit` of them), and the map keeps at most `maxKeys` keys — when it is
 * full, keys whose window has passed are dropped first, then the least
 * recently seen live key. A flood of distinct keys therefore costs a bounded
 * amount of memory, and can at worst reset other clients' allowance, never
 * grow the process.
 *
 * What this does not solve: which key to use. A server action in Next 15+
 * has no view of the connection address (NextRequest.ip was removed; the
 * host supplies it through headers), so the caller's key is whatever header
 * it decides to trust. See ai-actions.ts.
 */

const HOUR_MS = 60 * 60 * 1000

export const DEFAULT_MAX_CLIENTS = 10_000

/** BUILDER_AI_MAX_CLIENTS, or the default: how many client keys the limiter holds at once. */
export function maxClientsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.BUILDER_AI_MAX_CLIENTS)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_MAX_CLIENTS
}

export function createHourlyLimiter(options: {
  /** Calls allowed per key per hour; read on every call so a config change applies at once. */
  limit: () => number
  /** Most keys held at once. */
  maxKeys: number
  now?: () => number
  windowMs?: number
}) {
  const { limit, now = Date.now, windowMs = HOUR_MS } = options
  const maxKeys = Math.max(1, Math.floor(options.maxKeys))
  // Insertion order is recency order: a touched key is deleted and re-set.
  const calls = new Map<string, number[]>()

  function sweep(at: number) {
    for (const [key, times] of calls) {
      if (!times.some((t) => at - t < windowMs)) calls.delete(key)
    }
  }

  function makeRoom(at: number) {
    if (calls.size < maxKeys) return
    sweep(at)
    while (calls.size >= maxKeys) {
      const oldest = calls.keys().next().value
      if (oldest === undefined) return
      calls.delete(oldest)
    }
  }

  return {
    allow(key: string): boolean {
      const at = now()
      const recent = (calls.get(key) ?? []).filter((t) => at - t < windowMs)
      calls.delete(key)
      if (recent.length >= limit()) {
        makeRoom(at)
        calls.set(key, recent)
        return false
      }
      recent.push(at)
      makeRoom(at)
      calls.set(key, recent)
      return true
    },
    get size(): number {
      return calls.size
    },
  }
}
