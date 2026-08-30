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

## What is here today

- **Auth** — email/password sign-up, with a profile row created automatically.
- **The module spec** (`src/lib/modules/spec.ts`) — the contract every app is
  validated against, ours and third parties' alike.
- **The runtime** — generates a complete admin UI (list, add, edit, reorder,
  delete), a settings form, and four public templates from a manifest alone.
- **Dashboard** — installed apps, the store, per-app admin, public page settings.
- **Public layer** — the profile page and a standalone page per app, with QR
  links for each.
- **Three working apps** — QR Menu, Song Requests, Link Hub.
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
- **IP addresses are never stored** — rate limiting uses a per-app salted hash.

## Running it

```bash
npm install

# 1. Create a Supabase project, then:
cp .env.example .env.local     # fill in the URL and anon key

# 2. Apply the schema (Supabase SQL editor, or the CLI):
#    supabase/migrations/0001_foundation.sql
#    supabase/migrations/0002_security.sql

npm run dev
```

```bash
npm test          # runtime and manifest validation
npm run typecheck
npm run build
```

## Project layout

```
src/lib/modules/spec.ts        The manifest contract — the heart of the platform
src/lib/modules/registry.ts    Validated catalogue of available apps
src/lib/runtime/values.ts      Server-side validation for every write
src/components/runtime/        Generates admin UI from a manifest
src/components/public/         The four public templates the runtime owns
src/modules/<id>/manifest.ts   The apps themselves — declarations only
src/app/dashboard/             Owner-facing screens and server actions
src/app/u/[handle]/            The public layer
supabase/migrations/           Schema and Row Level Security
```

## Deliberately not built yet

- **The AI builder.** Describe an app and get a manifest. The runtime had to
  come first: with it working, the builder is a thin layer that emits a manifest
  and validates it through the same gate everything else uses.
- **Publish and install between users.** The schema is ready; the flows are not.
- **Payments.** Author, price and pricing model already exist on listings.
- **Cross-app interop.** Shared entities and an event bus, so apps compose
  through the platform rather than calling each other directly.
- **Teams.** Today one account is one owner.
