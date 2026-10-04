// Pins the behaviour of the rules generated from gcr-api-clean lib/storeManifest.js.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { generate, sourcePath } from '../scripts/sync-store-rules.mjs'
import { prepareVersion, permissionIds, configKeys, SEMVER } from '../src/store-rules.js'

const item = { key: 'acme-app', kind: 'app', name: 'Acme', publisher: 'acme' }

test('semver must look like 1.2.3', () => {
  assert.deepEqual(prepareVersion(item, { semver: '1.2' }), { ok: false, error: 'semver must look like 1.2.3.' })
  assert.ok(SEMVER.test('1.2.3-beta.1+build.5'))
})

test('manifest must be an object and match the version', () => {
  assert.equal(prepareVersion(item, { semver: '1.0.0', manifest: [] }).error, 'manifest must be an object.')
  assert.equal(prepareVersion(item, { semver: '1.0.0', manifest: { version: '0.9.0', runtime: {} } }).error, 'manifest.version (0.9.0) does not match 1.0.0.')
})

test('an app gets id, name, publisher and schema_version filled from the item', () => {
  const r = prepareVersion(item, { semver: ' 1.0.0 ', manifest: { runtime: { type: 'hosted' }, permissions: ['b', { id: 'a' }, 'b'] } })
  assert.equal(r.ok, true)
  assert.equal(r.manifest.id, 'acme-app')
  assert.equal(r.manifest.name, 'Acme')
  assert.equal(r.manifest.publisher, 'acme')
  assert.equal(r.manifest.schema_version, 1)
  assert.equal(r.manifest.version, '1.0.0')
  assert.deepEqual(r.permissions, ['a', 'b'])
})

test('an app needs its id to be the item key, and a runtime', () => {
  assert.match(prepareVersion(item, { semver: '1.0.0', manifest: { id: 'x-y', runtime: {} } }).error, /must be the item key/)
  assert.match(prepareVersion(item, { semver: '1.0.0', manifest: {} }).error, /needs a runtime/)
  assert.equal(prepareVersion({ ...item, kind: 'map' }, { semver: '1.0.0', manifest: {} }).ok, true)
})

test('permissionIds and configKeys read every shape', () => {
  assert.deepEqual(permissionIds([' x ', { name: 'y' }, { key: 'z' }, null, 3]), ['x', 'y', 'z'])
  assert.deepEqual(permissionIds('nope'), [])
  assert.deepEqual(configKeys({ config: [{ key: 'a' }, {}, { key: 'b' }] }), ['a', 'b'])
  assert.deepEqual(configKeys({ config: { properties: { c: {} } } }), ['c'])
  assert.deepEqual(configKeys({ config: { d: 1 } }), ['d'])
  assert.deepEqual(configKeys({}), [])
})

test('src/store-rules.js is generated from gcr-api-clean, unedited', (t) => {
  const src = sourcePath()
  if (!existsSync(src)) return t.skip(`no gcr-api-clean checkout at ${src}`)
  const current = readFileSync(fileURLToPath(new URL('../src/store-rules.js', import.meta.url)), 'utf8')
  assert.equal(current, generate(readFileSync(src, 'utf8')), 'out of date: run npm run sync:store-rules')
})

test('the generator refuses a source it cannot convert faithfully', () => {
  assert.throws(() => generate("const x = require('y')\nmodule.exports = { x };"), /pure/)
  assert.throws(() => generate('function a() {}\n'), /module\.exports/)
  assert.throws(() => generate('function a() {}\nmodule.exports = { a, b };'), /b is exported/)
})
