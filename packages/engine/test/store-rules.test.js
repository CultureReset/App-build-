// Pins the behaviour of the rules copied from gcr-api-clean lib/storeManifest.js.
import assert from 'node:assert/strict'
import { test } from 'node:test'
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
