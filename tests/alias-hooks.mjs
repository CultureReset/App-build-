import path from 'node:path'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * Resolves the "@/..." path alias for the test runner.
 *
 * Next.js resolves this alias through tsconfig paths; plain Node does not, so
 * tests get the same mapping here rather than importing production code through
 * a different specifier than the app uses.
 */
const root = path.resolve(import.meta.dirname, '..', 'src')

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) {
    return next(specifier, context)
  }

  const target = path.join(root, specifier.slice(2))

  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')]) {
    if (existsSync(candidate)) {
      return next(pathToFileURL(candidate).href, context)
    }
  }

  return next(specifier, context)
}
