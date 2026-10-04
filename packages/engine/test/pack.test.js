// What `npm pack` would publish. Consumers (Play-user, Boxes daemon,
// gcr-unified, the App-build- dashboard) import the package root, ./react,
// ./html and ./styles.css; every one of those must resolve to a file inside
// the tarball, and the tarball must hold nothing but the runtime sources,
// the README and package.json — no tests, scripts or stray files.
//
// `--ignore-scripts` keeps this safe to run from the prepack hook: the
// dry run does not fire prepack again.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** The subpaths consumers import today. */
const CONSUMER_SUBPATHS = ['.', './react', './html', './styles.css']

/** Every file path a package.json entry points at ("./src/x.js" → "src/x.js"). */
function targetsOf(value) {
  if (typeof value === 'string') return value.startsWith('./') ? [value.slice(2)] : []
  if (value && typeof value === 'object') return Object.values(value).flatMap(targetsOf)
  return []
}

function filesUnder(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? filesUnder(full, base) : [relative(base, full).split('\\').join('/')]
  })
}

function packedFiles() {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const [report] = JSON.parse(out)
  return report.files.map((f) => f.path).sort()
}

test('the package is publishable as @nextgent/app-engine', () => {
  assert.equal(pkg.name, '@nextgent/app-engine')
  assert.equal(pkg.private, undefined, 'private: true blocks npm publish')
  assert.ok(pkg.version && pkg.description && pkg.license, 'version, description and license are set')
  assert.equal(pkg.repository?.directory, 'packages/engine')
  assert.match(pkg.repository?.url || '', /App-build-/)
  assert.equal(pkg.type, 'module')
})

test('every subpath a consumer imports is in the exports map', () => {
  for (const subpath of CONSUMER_SUBPATHS) assert.ok(pkg.exports[subpath], `exports["${subpath}"] is missing`)
  for (const subpath of Object.keys(pkg.exports)) {
    const entry = pkg.exports[subpath]
    if (subpath.endsWith('.css')) continue
    assert.ok(entry.types, `exports["${subpath}"] has no types condition`)
    assert.ok(entry.default, `exports["${subpath}"] has no default condition`)
  }
})

test('the tarball holds the runtime sources, README and package.json, and nothing else', () => {
  const packed = packedFiles()
  const expected = ['package.json', 'README.md', ...filesUnder(join(root, 'src')).map((f) => `src/${f}`)].sort()
  assert.deepEqual(packed, expected)
  for (const target of targetsOf({ main: pkg.main, types: pkg.types, exports: pkg.exports })) {
    assert.ok(packed.includes(target), `${target} is referenced from package.json but not packed`)
  }
  for (const f of packed) assert.ok(!/^(test|scripts)\//.test(f), `${f} must not be published`)
})
