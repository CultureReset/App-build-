# The apps that ship

One engine manifest per app (`<name>/manifest.json`), the only definition of each (DECISIONS #42). The
builder starts from these, the home page lists them, and the Paperclip store publishes them.

What each app reads from the business and what it creates for the owner (scoping 5.3; DECISIONS #44, #45,
#47). A **binding** is a data contract the business already keeps; an **app table** is the app's own.

| App | Reads from the business | Writes to the business | Own tables | Visitor door | Emits |
| --- | --- | --- | --- | --- | --- |
| action-buttons | — | — | `shortcuts` (public read) | — | — |
| actions | `business.profile` (binding `profile`, read: phone, email, website, booking and directions links) — public `actions` template; owner `profile-editor` (read-only through this app; the profile app edits it) | — | — | — | — |
| enquiry-form | `leads.items` (binding `leads`) | each enquiry becomes a lead; also an inbox message (`inbox: true`) | — | the enquiry form | `core-enquiry-form.submitted` |
| faq | `faqs.items` (binding `faqs`) | the owner edits questions and answers in place | — | — | — |
| gallery | `media.images` (binding `media`; `image_url` → column `url`) — public `gallery` template (grid/carousel, lightbox, cover first) | the owner adds, captions, reorders photos and picks the cover (`media-manager` template) | — | — | — |
| link-hub | — | — | `links` (public read) | — | — |
| listings | `listings.items` (binding `listings`, source `catalogue`, served from `offerings`; `title` → `name`, `price` → `price_from`, `visible` → `active`; `kind` is a filterable field, DECISIONS #62; `image_url` is the photo), `business.currency` for prices — public `listings` template | the owner adds, shows/hides, reorders and edits listings (`listing-manager` template) | — | — | — |
| profile | `business.profile` (binding `profile`, read-write: name, tagline, about, address, logo, cover, contact links; `address_display`, the address on one line, is derived by gcr-api-clean and read-only) — public `profile` template; owner `profile-editor` | the owner edits the one profile record in place (PATCH without an id, DECISIONS #96; `business:write`) | — | — | — |
| qr-menu | `menu.sections`, `menu.items` (bindings; items order by `sort_order` and hide by `is_available`, sql/nextgent_menu_items_order.sql, DECISIONS #65; `image_url` the photo, `tags` the badges — a `tags` field over the text[] column), `business.currency` for prices — public `menu` template (sticky section nav, cards, sold-out state, item detail) | the owner edits sections and items, toggles sold out, edits prices in place (`menu-editor` template; `menu:write`, optional) | — | — | — |
| social-links | `business.links` (binding `links`), served as rows `{id, network, url}` (DECISIONS #63); the network is whatever the business keeps, not a list written here — public `social` template (icons keyed by a slug of the network, for the owner's stylesheet) | the owner adds links | — | — | — |
| song-requests | — | — | `requests` (public append, `inbox: true`) | the request form | `core-song-requests.submitted` |
| video | — | — | `videos` (public read) | — | — |

Permissions follow from the bindings (`<resource>:read`, plus `<resource>:write` for read-write): every
binding above is to a `business` family contract except qr-menu's, which are `menu`, and enquiry-form's
`leads.items`, which is `contacts` (DECISIONS #59). Currency is the
business's own setting (`ui.format.currency: { "binding": "currency" }`), never an install setting.

Events are namespaced `<manifest id>.<event>`, the id being the store key (DECISIONS #47, #55); the registry
of valid app events is the set of installed manifests. Column names: each bound source uses the contract's columns unless its binding
declares a `fieldMap` — gcr-api-clean's `lib/dataContracts.js` is the one place that names them.
`tests/contracts.test.ts` checks every bound field, after its fieldMap, against those columns, and reads the
registry from a sibling `gcr-api-clean` checkout when there is one.
