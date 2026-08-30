# Modular

A web app store where the apps are **containers, not code**.

A user signs up, installs the apps they need, edits them directly, and chooses
which ones the public sees. Every app is self-contained: installing, editing or
removing one cannot affect any other. The owner never touches code, hosting,
schemas or security.

## The idea in one paragraph

Most "AI builds your app" products generate a codebase per project. That makes
every app an island: they can't safely share a page, they can't interoperate,
their security can't be centrally guaranteed, and the output walks off the
platform. This project takes the opposite approach. **An app is a declaration —
a manifest — and one shared runtime renders every manifest.** A module says what
data it stores, what screens its owner gets, and what (if anything) visitors
see. It never ships executable code. That single decision is what makes the rest
possible: apps can't break each other, security is enforced once for all of
them, and an app is a small, diffable, versionable, sellable artifact.

## One login, one dashboard

Everything a user builds lives behind a single account. Apps they install, the
content inside them, the design of their page and the layouts they publish are
all reached from one dashboard — a SaaS platform where the features are things
you choose rather than things you are given.

## The three faces of an app

An app declares up to three surfaces, and many have only one or two:

| Surface | Audience | Example |
| --- | --- | --- |
| **Admin** | the owner, in their dashboard | edit menu items, work the request queue |
| **Public** | anyone with the link or QR code | the menu itself, the request form |
| **Headless** | nobody — runs behind the scenes | a back-office tool with nothing to publish |

Every account also gets one public profile page at `/u/<handle>` that stacks the
public surfaces of whatever the owner switched on — a Linktree-style listing
built from real, live apps rather than static links.

## Reusable layouts

A **layout** is the second reusable artifact in the ecosystem, alongside apps:
a theme plus an ordered plan of blocks. Publish the design you built and anyone
can apply it — they get the same look and the same blocks in the same order,
filled with their own content. Applying a layout is additive: missing blocks are
installed, existing ones are repositioned, and nothing you already have is
deleted. Only the shape travels; no records, settings or submissions ever do.

Six layouts ship with the platform (Real Estate Agent, Restaurant, DJ &
Nightlife, Creator, Trades & Services, Dark Hub). A user-published layout goes
through the exact same validation as a built-in one.

## Designing the page

Owners restyle their whole public page from the dashboard: six starting presets,
then colour, block style, corners, typeface, button shape, spacing, page width,
header layout and heading treatment — with a live preview built from the real
components. Each block also picks its own display variant (a listing block can
be a grid, cards or a list; links can be buttons or a grid) without touching the
module itself, so the same app looks different on two different pages.

This is a wide set of **validated** options rather than free-form CSS. That is a
deliberate trade: arbitrary styling from thousands of accounts would be an
injection surface and would make every third-party block unsafe to render on a
shared page. The theme compiles to CSS custom properties, and the runtime is the
only thing that ever writes markup.

## What is here today

- **Auth** — email/password sign-up, with a profile row created automatically.
- **The module spec** (`src/lib/modules/spec.ts`) — the contract every app is
  validated against, ours and third parties' alike.
- **The runtime** — generates a complete admin UI (list, add, edit, reorder,
  delete) and a settings form from a manifest, and renders ten public templates
  across their display variants.
- **Dashboard** — installed apps, the store with an install-time permission
  prompt, per-app admin, and a page studio (details, blocks, design, layouts).
- **Public layer** — a themed profile page at `/u/<handle>` stacking the blocks
  an owner switched on, plus a standalone page and QR link per block.
- **Ten working apps** — Listings, Action Buttons, Social Links, Enquiry Form,
  Gallery, Video, FAQ, Link Hub, QR Menu, Song Requests.
- **A live example** at `/preview` — the real public renderer with sample
  content and a theme switcher, so the front end can be judged before any
  database exists.
- **Security** — see below.
- **Marketplace schema** — `module_listings` carries author, version, price and
  status from day one, so publishing and selling never need a schema retrofit.

## Security model

The platform owns security so that app builders never have to. That promise is
kept in the database, not in application code:

- **Row Level Security on every table**, denying by default. A bug in a page or
  an action cannot leak another tenant's data.
- **Two flags, both required, for anything public.** A visitor sees an app only
  when the owner published their page *and* switched that specific app on.
- **No service-role client anywhere in the codebase.** Every query, including
  those on public pages, runs as the signed-in user or as `anon`.
- **One guarded door for anonymous writes.** Visitors have no `INSERT` on any
  table. Submissions go through `submit_public_record()`, which re-checks that
  the app is live and accepting, that the collection is explicitly
  public-writable, that the payload is a flat object within size limits, and
  that the client is inside its rate-limit window.
- **Owner-only fields are stripped from public forms** and re-applied from their
  declared defaults server-side, so a visitor cannot set a status, a flag or a
  price no matter what they post.
- **Undeclared keys are dropped, never stored.** A modified client cannot write
  a field the module did not declare.
- **URLs are restricted to http(s)**, so a link block can never carry
  `javascript:` or `data:`.
- **Only YouTube and Vimeo can be embedded**, and only after the URL is reduced
  to an id the platform builds the iframe `src` from itself. No owner can point
  a frame at an arbitrary origin.
- **Themes are named options, not CSS.** Every value is schema-checked before it
  reaches a stylesheet, and an invalid stored theme falls back to the default
  rather than breaking a page.
- **IP addresses are never stored** — rate limiting uses a per-app salted hash.

## Running it

```bash
npm install

# 1. Create a Supabase project, then:
cp .env.example .env.local     # fill in the URL and anon key

# 2. Apply the schema (Supabase SQL editor, or the CLI):
#    supabase/migrations/0001_foundation.sql
#    supabase/migrations/0002_security.sql
#    supabase/migrations/0003_pages.sql

npm run dev
```

```bash
npm test          # runtime, manifest, theme and layout validation
npm run typecheck
npm run build
```

## Project layout

```
src/lib/modules/spec.ts          The manifest contract — the heart of the platform
src/lib/modules/registry.ts      Validated catalogue of available apps
src/lib/runtime/values.ts        Server-side validation for every write
src/lib/runtime/embeds.ts        The embed allowlist
src/lib/theme/spec.ts            The theme contract and its presets
src/lib/theme/templates.ts       Reusable layouts, including the built-ins
src/components/runtime/          Generates admin UI from a manifest
src/components/public/templates/ The ten public templates the runtime owns
src/components/design/           The page studio: theme, blocks, layouts
src/modules/<id>/manifest.ts     The apps themselves — declarations only
src/app/dashboard/               Owner-facing screens and server actions
src/app/u/[handle]/              The public layer
src/app/preview/                 A live example of the public front end
supabase/migrations/             Schema and Row Level Security
```

## Deliberately not built yet

- **The AI builder.** Describe an app and get a manifest. The runtime had to
  come first: with it working, the builder is a thin layer that emits a manifest
  and validates it through the same gate everything else uses.
- **Publishing apps between users.** Layouts are already shareable; app
  manifests are not yet. The schema is ready, the flow is not.
- **Payments.** Author, price and pricing model already exist on listings.
- **Cross-app interop.** Shared entities and an event bus, so apps compose
  through the platform rather than calling each other directly.
- **Teams.** Today one account is one owner.
