# @nextgent/app-engine

An app is a **manifest**, drawn by **one shared runtime** on every screen, with
its data only through **gcr-api-clean**. This package is that runtime. It has
no dependencies (React is an optional peer for `./react`) and no knowledge of
any particular app, business or industry.

```
manifest ──validateManifest──▶ ok
manifest + settings + rows + actions ──renderOwner / renderPublic──▶ blocks
blocks ──<Blocks/> (React) / renderHtml (string) / Boxes (TV, later)──▶ screen
screen action ──adapter──▶ gcr-api-clean /api/business/* · /api/app-data/*
```

## Layout

| File | What it is |
| --- | --- |
| `src/manifest.js` | `validateManifest`: app-manifest v1 checks, the store's version rules, the engine's own checks |
| `src/store-rules.js` | `prepareVersion`, `permissionIds`, `configKeys`, `SEMVER` — identical to gcr-api-clean `lib/storeManifest.js` |
| `src/render.js` | `renderOwner`, `renderPublic`, `renderSurface`, `checkRecord`, `sourcesFor` — pure, data in, blocks out |
| `src/blocks.js` | the block vocabulary and `checkBlocks` |
| `src/values.js`, `src/format.js`, `src/copy.js` | field checks, display formatting (Intl, locale/currency from settings), the engine's own words |
| `src/html.js` | `renderHtml(blocks)` — escaped static HTML for server-side / prerendered public blocks |
| `src/react.js` | `<Blocks>` and `<EngineApp>` — React drawing and the owner/visitor loop |
| `src/adapter.js` | `createGcrAdapter`, `createPublicAdapter` — the only way data moves |
| `src/store.js` | `toStorePublication`, `publishToStore` — a manifest as a Paperclip store release |
| `src/styles.css` | optional starting styles (custom properties only) |
| `src/index.d.ts`, `src/react.d.ts` | types |

## The manifest

app-manifest v1 (`cybercheck-cloud/contract/app-manifest.v1.json`) as is, plus:

- `runtime: { "type": "engine", "engine": "1" }` — drawn by this package; nothing of the app runs anywhere.
- `ui` — what the engine draws:
  - `ui.sources.<key>` — where rows come from. `from: "business"` names a gcr-api-clean section and the
    CONTRACT §6 resource it belongs to (`section: "menu_items", resource: "menu"`); `from: "app"` names a
    table in v1's `data.tables` (the app's own data space). Each source lists its `fields` (key, label,
    type, options or `optionsFrom`, required, ownerOnly …) and which field is the `title`, `subtitle`,
    `group`, `order` (+ `sortable`) and `visibleWhen` flag.
  - `ui.views.<set>` — an ordered list of views. Every `surfaces[]` entry's `path` is `/<set>`, so v1's
    surfaces stay valid: `kind: "dashboard"` / `"settings"` → the owner screen, `"public"` → the public
    block, `"widget"` → a card (TV).
  - `ui.format` — `currency` and `locale`, literal or `{ "setting": "<config key>" }`.

### Views

| View | Where | Binds (`fields`) | Styles |
| --- | --- | --- | --- |
| `collection` | owner | — (uses the source's title/subtitle/group) | — |
| `settings` | owner | — (v1 `config`) | — |
| `list` | any | title, subtitle, body, image, value, badge, link, meta[≤4] | list, cards, grid |
| `links` | any | label, link, icon (a select whose options carry `icon`), emphasis, note | stack, inline, grid, icons |
| `images` | any | image, caption, link | grid, strip, feature |
| `details` | any | summary, body | accordion, list |
| `embed` | any | link, title — only through providers the screen configured | feature, stack |
| `form` | public | — (every non-owner-only field); `intro`, `openWhen`, `submitLabel` | stack, feature |
| `feed` | any | title, subtitle, body (newest first, relative time) | list, cards |
| `text` | any | `text`: literal or `{ setting }` | — |

What the validator refuses, beyond v1: a view naming an unknown source, field or setting; an owner view
on a public surface; an owner-only field bound on a public surface; a public view reading an app table
that is not public `read`/`read-append`, or a form writing one that is not `append`; a business source
without its `<resource>:read` permission, or a business write without `<resource>:write`; an app field
on a column it does not declare or of an incompatible type; a select without options.

### Where this goes beyond app-manifest v1 (reported upstream)

1. `runtime.type: "engine"` — v1's `runtime` is `oneOf hosted | service`.
2. The `ui` section — v1 has `additionalProperties: false` at the top level.
3. Permission ids: v1's pattern is dotted (`availability.read`); CONTRACT §6, Paperclip
   (`NEXTGENT_PERMISSION_PATTERN`) and gcr-api-clean write `resource:action`. The engine follows the
   contract and names the dotted form in its error. `surfaces[].requires_permission` likewise.
4. v1 config has no long-text type; long settings are `text`.

gcr-api-clean's `lib/storeManifest.js` only checks that `runtime` is an object, so it accepts all four.

## Blocks

Blocks are JSON. Each screen draws them in its own style; class names are `<prefix>-<type>`
(`ng-` by default). Unknown types are skipped, so an older screen survives a newer engine.

| Block | Fields |
| --- | --- |
| `section` | `title?`, `blocks[]` — a view, or a group inside one |
| `heading` | `text`, `level` 1–3 |
| `text` | `text`, `tone?` (default, muted, success, warning, danger) |
| `notice` | `text`, `tone?` — status the viewer should notice |
| `empty` | `text` — nothing to show |
| `divider` | — |
| `list` | `style` (list, cards, grid, feed), `items[]`: `id?`, `title`, `subtitle?`, `body?`, `value?`, `badge?`, `meta?[]`, `image? {src, alt}`, `href?`, `time?`, `actions?[]` |
| `table` | `columns[] {key, label}`, `rows[] {id, cells{key: text}, actions?[]}`, `empty?` |
| `image` | `src`, `alt`, `caption?`, `href?` |
| `images` | `style` (grid, strip, feature), `items[] {src, alt, caption?, href?}` |
| `button` | `label`, `icon?`, `note?`, `style?` (primary, secondary, danger, ghost), exactly one of `href` / `action`, `disabled?` |
| `buttons` | `style` (stack, inline, grid, icons), `items[]` of buttons |
| `form` | `id`, `fields[] {key, label, type, required?, help?, placeholder?, options?, min?, max?, maxLength?}`, `values`, `errors?` (`_form` for the whole form), `submit {label, action}`, `cancel?`, `intro?`, `style?`, `readOnly?` |
| `details` | `style` (accordion, list), `items[] {summary, body}` |
| `embed` | `src` (https, from a configured provider), `title` |

Actions (on buttons and form submits): `record.create`, `record.update`, `record.delete`,
`record.move` (`direction` up/down), `settings.save`, `form.submit`, and the screen-local
`view.new`, `view.edit`, `view.cancel`. A screen that draws blocks itself carries them out through
the adapter, or uses `<EngineApp>` which does.

Links are limited to http, https, mailto, tel and sms; images and embeds to http(s)/https — checked
by the renderer and again by every drawer.

## Rendering

```js
import { renderOwner, renderPublic, renderSurface } from '@nextgent/app-engine'

renderOwner(manifest, settings, data, actions, options)   // → Block[]
renderPublic(manifest, settings, data, actions, options)
renderSurface(manifest, 'tv', settings, data, actions, options)
```

- `data`: `{ [sourceKey]: row[] }` as gcr-api-clean returns rows.
- `actions`: `{ granted?, editing?, values?, errors?, submitted?, settings? }` — `granted` is the
  install's approved permissions (default: everything declared); business writes appear only when
  `<resource>:write` is granted.
- `options`: `{ copy?, locale?, currency?, now?, embeds? }`. `embeds` is the list of players the
  screen allows — `{ hosts: [...], id: { from: 'query', param } | { from: 'path' }, pattern, src: 'https://…/{id}' }`,
  from the screen's configuration. With none, nothing is embedded.

## Data

```js
import { createGcrAdapter, createPublicAdapter } from '@nextgent/app-engine'

const adapter = createGcrAdapter({
  baseUrl: '/biz',                         // Play-user's proxy to gcr-api-clean /api (CONTRACT §2)
  getToken: ({ force }) => installToken(force),
})
const { settings, granted, data, errors } = await adapter.load(manifest, 'owner')
```

| Route (under gcr-api-clean `/api`) | Used for | Exists |
| --- | --- | --- |
| `GET/POST /business/:section`, `PATCH/DELETE /business/:section/:id` | business sources | yes (`routes/business-data.js`, permissions per CONTRACT §6) |
| `GET/POST /app-data/:table`, `PATCH/DELETE /app-data/:table/:id` | the app's own records, scoped by the install token's `install_id` | **no** |
| `GET /app-install` → `{ installId, itemKey, version, settings, granted }` | the install behind the token | **no** |
| `PUT /app-install/settings` `{ settings }` → `{ settings }` | saving settings (only `configKeys`) | **no** |
| `GET /public/apps/:installId` → `{ settings, data }` | what a visitor may read (public views' sources only) | **no** |
| `POST /public/apps/:installId/:table` | a visitor's form, into a table declared public `append` | **no** |

Routes can be overridden (`routes: { … }`) if gcr-api-clean names them differently. A missing route
shows as `err.notConnected` per source; it does not take the screen down.

## Using it from a screen

Until the package is published to a registry, a screen depends on it from git or a local path:

```json
"@nextgent/app-engine": "file:../App-build-/packages/engine"
```

**Play-user** (owner screen, installed app's "Open"):

```jsx
import { EngineApp } from '@nextgent/app-engine/react'
import { createGcrAdapter } from '@nextgent/app-engine'
import '@nextgent/app-engine/styles.css' // or style ng-* classes in app.css

const adapter = createGcrAdapter({ baseUrl: '/biz', getToken: ({ force }) => installToken(item, force) })
<EngineApp manifest={item.manifest} surface="owner" adapter={adapter} options={{ locale }} />
```

**gcr-unified** (public page block):

```jsx
import { EngineApp } from '@nextgent/app-engine/react'
import { createPublicAdapter, renderPublic, renderHtml } from '@nextgent/app-engine'

<EngineApp manifest={manifest} surface="public" adapter={createPublicAdapter({ baseUrl: GCR_API, installId })} options={{ embeds }} />
// prerender: renderHtml(renderPublic(manifest, settings, data, {}, { embeds }), { formAction: (a) => submitUrl(a) })
```

## Publishing

```js
import { toStorePublication, publishToStore } from '@nextgent/app-engine'
const pub = toStorePublication(manifest, { channel: 'stable' })
await publishToStore(pub, { baseUrl: PAPERCLIP_URL, credentials: 'include' }) // an instance admin's session
```

`item` → `POST /api/store/admin/items`; `version` → `POST /api/store/admin/items/:id/versions` with
`payload: { nextgent: { kind: 'app', permissions: [{ permission, reason }] }, app: <manifest> }`.

Two gaps on Paperclip's side today: `STORE_ITEM_KINDS` (plugin, pack, skill, automation, connector)
has no `app`, so the item is refused until it is added (`release.kind` can name another kind
meanwhile); and the non-plugin payload schema (`storePayloadSchema`, a zod object) strips keys it
does not know, so `payload.app` must be added to it to be kept. The `nextgent` section also has no
`optional` flag, so optional permissions arrive as required.

## Tests

`npm test` (from this folder) — validator, store rules, both renderers, HTML, React, adapter, store.
