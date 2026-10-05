# The apps that ship

One engine manifest per app (`<name>/manifest.json`), the only definition of each (DECISIONS #42). The
builder starts from these, the home page lists them, and the Paperclip store publishes them.

What each app reads from the business and what it creates for the owner (scoping 5.3; DECISIONS #44, #45,
#47). A **binding** is a data contract the business already keeps; an **app table** is the app's own.

| App | Reads from the business | Writes to the business | Own tables | Visitor door | Emits |
| --- | --- | --- | --- | --- | --- |
| action-buttons | — | — | `shortcuts` (public read) | — | — |
| enquiry-form | `leads.items` (binding `leads`) | each enquiry becomes a lead; also an inbox message (`inbox: true`) | — | the enquiry form | `enquiry-form.submitted` |
| faq | `faqs.items` (binding `faqs`) | the owner edits questions and answers in place | — | — | — |
| gallery | `media.images` (binding `media`) | the owner adds, captions and reorders photos | — | — | — |
| link-hub | — | — | `links` (public read) | — | — |
| listings | `listings.items` (binding `listings`), `business.currency` for prices | the owner adds and edits listings | — | — | — |
| qr-menu | `menu.sections`, `menu.items` (bindings), `business.currency` for prices | the owner edits menu items (`menu:write`, optional) | — | — | — |
| social-links | `business.links` (binding `links`); the network is whatever the business keeps, not a list written here | the owner adds and reorders links | — | — | — |
| song-requests | — | — | `requests` (public append, `inbox: true`) | the request form | `song-requests.submitted` |
| video | — | — | `videos` (public read) | — | — |

Permissions follow from the bindings (`<resource>:read`, plus `<resource>:write` for read-write): every
binding above is to a `business` family contract except qr-menu's, which are `menu`. Currency is the
business's own setting (`ui.format.currency: { "binding": "currency" }`), never an install setting.

Events are namespaced `<app>.<event>` (DECISIONS #47); the registry of valid app events is the set of
installed manifests. Column names: each bound source uses the contract's columns unless its binding
declares a `fieldMap` — gcr-api-clean's `lib/dataContracts.js` is the one place that names them.
