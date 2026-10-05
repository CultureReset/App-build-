// @nextgent/app-engine — an app is a manifest, drawn by one shared runtime.
// No dependencies. React drawing is in ./react (React is a peer), plain HTML
// in ./html. See README.md for the manifest, the views and the blocks.

export {
  SCHEMA_VERSION, ENGINE_RUNTIME, PERMISSION, FIELD_TYPES, VIEW_TYPES, SURFACE_KINDS,
  CONTRACT_FAMILIES, CONTRACTS, BINDING_ACCESS, ACTION_KINDS,
  validateManifest, parseManifest, permissionsOf, resourcesOf,
  resourceForContract, bindingPermissions, sourceResource, inboxTables, inboxBindings,
} from './manifest.js'
export { SEMVER, prepareVersion, permissionIds, configKeys } from './store-rules.js'
export { BLOCK_TYPES, ACTION_TYPES, BUTTON_STYLES, INPUT_TYPES, checkBlocks, walkBlocks } from './blocks.js'
export { renderOwner, renderPublic, renderSurface, surfacesOf, sourcesFor, checkRecord, embedSrc } from './render.js'
export { checkValues, blankValues, settingsWithDefaults, settingsFields, safeHref, safeImage, normaliseUrl } from './values.js'
export { formatValue, formatMoney, optionList } from './format.js'
export { DEFAULT_COPY } from './copy.js'
export { createGcrAdapter, createPublicAdapter, AdapterError, DEFAULT_ROUTES, EXISTING_ROUTES } from './adapter.js'
export { toStorePublication, publishToStore, APP_KIND } from './store.js'
export { renderHtml, escapeHtml } from './html.js'
