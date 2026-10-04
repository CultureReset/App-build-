#!/usr/bin/env node
// Generates src/store-rules.js from gcr-api-clean's lib/storeManifest.js, the
// one editable copy of the store's version rules.
//
//   npm run sync:store-rules          write src/store-rules.js
//   npm run sync:store-rules -- --check   exit 1 if it is out of date
//
// Where gcr-api-clean is: STORE_RULES_SOURCE (a path to storeManifest.js), or
// a gcr-api-clean checkout next to this repo. When neither is there (a deploy
// of a screen, say) --check reports it and passes: the generated file is
// committed, so nothing at build time needs gcr-api-clean.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, '..', 'src', 'store-rules.js')

export function sourcePath() {
  if (process.env.STORE_RULES_SOURCE) return resolve(process.env.STORE_RULES_SOURCE)
  return resolve(here, '..', '..', '..', '..', 'gcr-api-clean', 'lib', 'storeManifest.js')
}

const HEADER = `// GENERATED from gcr-api-clean lib/storeManifest.js by
// scripts/sync-store-rules.mjs — do not edit here. Change the rules in
// gcr-api-clean, then run \`npm run sync:store-rules\` in this package.
// test/store-rules.test.js pins the behaviour and fails when this file is
// out of date with a gcr-api-clean checkout beside this repo.
`

/** The CommonJS source turned into this package's ES module. */
export function generate(cjs) {
  const lines = cjs.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let exported = null
  for (const line of lines) {
    const m = /^module\.exports\s*=\s*\{([^}]*)\};?\s*$/.exec(line)
    if (m) {
      exported = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      continue
    }
    if (/\brequire\(/.test(line)) throw new Error('storeManifest.js must stay pure: no require().')
    out.push(line.replace(/^const (\w+) =/, 'export const $1 =').replace(/^function (\w+)/, 'export function $1'))
  }
  if (!exported) throw new Error('storeManifest.js must end with one `module.exports = { … }`.')
  const body = out.join('\n')
  for (const name of exported) {
    if (!new RegExp(`^export (const|function) ${name}\\b`, 'm').test(body)) throw new Error(`${name} is exported but not a top-level const or function.`)
  }
  return `${HEADER}\n${body.replace(/\n+$/, '')}\n`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = sourcePath()
  const check = process.argv.includes('--check')
  if (!existsSync(src)) {
    const msg = `gcr-api-clean's storeManifest.js not found at ${src} (set STORE_RULES_SOURCE).`
    if (check) {
      console.log(`${msg} Skipped.`)
      process.exit(0)
    }
    console.error(msg)
    process.exit(1)
  }
  const fresh = generate(readFileSync(src, 'utf8'))
  if (check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : ''
    if (current !== fresh) {
      console.error('src/store-rules.js is out of date: run npm run sync:store-rules.')
      process.exit(1)
    }
    console.log('src/store-rules.js matches gcr-api-clean.')
  } else {
    writeFileSync(target, fresh)
    console.log(`Wrote ${target}`)
  }
}
