// The template registry. A template (CONS phases 9–10, DECISIONS #51) is one
// module in this folder that turns a view of a manifest into blocks. Each
// module exports the same shape and knows nothing of the others:
//
//   {
//     name      the view type a manifest writes: `{ "type": "menu" }`
//     surface   'public' (drawn for visitors and owners) | 'owner' (owner only)
//     summary   one line for a picker
//     spec      what the validator enforces (manifest.js):
//                 slots[]       field slots a view may bind
//                 multi[]       slots that take a list of fields
//                 styles[]      allowed `style` values (first is the default)
//                 required[]    slots a view must bind
//                 defaultSlot   the slot that falls back to the source's title
//                 slotTypes     { slot: fieldType } a bound field must have
//                 single        true: shows one row (the first); no grouping
//     tokens[]  the CSS custom properties its stylesheet (<name>.css) reads
//     check?    (view, { fields, add }) extra validation, errors through add(slot, message)
//     render    (ctx, view, env) → Block[]   env: { sourceKey, source, rows, allRows, surface }
//                 rows     ordered, and on a public surface without hidden rows
//                 allRows  ordered only (a template that marks hidden rows instead)
//     blocks?   { [blockType]: { check, html, react } } block primitives only
//               this template emits; primitives two templates share live in
//               ../blocks.js, ../html.js and ../react.js instead
//   }
//
// Adding a template: write <name>.js (+ <name>.css, imported by ../styles.css),
// import it below. Removing one: delete the two lines. Nothing else changes.

import profile from './profile.js'
import actions from './actions.js'
import social from './social.js'
import gallery from './gallery.js'
import menu from './menu.js'
import listings from './listings.js'
import availability from './availability.js'
import profileEditor from './profile-editor.js'
import mediaManager from './media-manager.js'
import menuEditor from './menu-editor.js'
import listingManager from './listing-manager.js'
import availabilityCalendar from './availability-calendar.js'

const NAME = /^[a-z][a-z0-9-]*$/
const registry = new Map()

/** The problems with a module's shape (empty = a template). */
export function checkViewModule(mod) {
  const out = []
  if (!mod || typeof mod !== 'object') return ['a template is an object']
  if (typeof mod.name !== 'string' || !NAME.test(mod.name)) out.push('name is lowercase letters, digits and dashes')
  if (!['public', 'owner'].includes(mod.surface)) out.push('surface is public or owner')
  if (typeof mod.summary !== 'string' || !mod.summary) out.push('summary is a line of text')
  const s = mod.spec
  if (!s || typeof s !== 'object') out.push('spec is an object')
  else {
    if (!Array.isArray(s.slots)) out.push('spec.slots is a list')
    for (const k of ['multi', 'styles', 'required']) if (s[k] !== undefined && !Array.isArray(s[k])) out.push(`spec.${k} is a list`)
    if (s.required) for (const r of s.required) if (!s.slots.includes(r)) out.push(`spec.required names unknown slot "${r}"`)
    if (s.defaultSlot !== undefined && !s.slots.includes(s.defaultSlot)) out.push('spec.defaultSlot names an unknown slot')
    if (s.slotTypes) for (const k of Object.keys(s.slotTypes)) if (!s.slots.includes(k)) out.push(`spec.slotTypes names unknown slot "${k}"`)
  }
  if (!Array.isArray(mod.tokens) || !mod.tokens.every((t) => typeof t === 'string' && t.startsWith(`--ng-${mod.name}-`))) out.push(`tokens are --ng-${mod.name}-* names`)
  if (typeof mod.render !== 'function') out.push('render is a function')
  if (mod.check !== undefined && typeof mod.check !== 'function') out.push('check is a function')
  if (mod.blocks !== undefined) {
    if (!mod.blocks || typeof mod.blocks !== 'object') out.push('blocks is an object')
    else for (const [type, d] of Object.entries(mod.blocks)) {
      if (!d || ['check', 'html', 'react'].some((k) => typeof d[k] !== 'function')) out.push(`blocks.${type} needs check, html and react functions`)
    }
  }
  return out
}

export function registerView(mod) {
  const problems = checkViewModule(mod)
  if (problems.length) throw new Error(`Template "${mod?.name}" is not well formed: ${problems.join('; ')}.`)
  for (const type of Object.keys(mod.blocks || {})) {
    const owner = [...registry.values()].find((m) => m !== mod && m.blocks && m.blocks[type])
    if (owner) throw new Error(`Template "${mod.name}" declares block "${type}", which "${owner.name}" already owns; a shared primitive belongs in blocks.js.`)
  }
  registry.set(mod.name, mod)
  return mod
}

export function unregisterView(name) {
  return registry.delete(name)
}

export function viewModule(name) {
  return registry.get(name) || null
}

/** Registered templates, in registration order. */
export function viewModules() {
  return [...registry.values()]
}

/** { [name]: spec } as manifest.js's VIEW_TYPES wants it, read live. */
export function templateSpecs() {
  const out = {}
  for (const m of registry.values()) {
    const s = m.spec
    const spec = { slots: s.slots }
    if (s.multi) spec.multi = s.multi
    if (s.styles) spec.styles = s.styles
    if (m.surface === 'owner') spec.owner = true
    if (s.required) spec.required = s.required
    if (s.defaultSlot) spec.defaultSlot = s.defaultSlot
    if (s.slotTypes) spec.slotTypes = s.slotTypes
    if (s.single) spec.single = true
    spec.template = true
    out[m.name] = spec
  }
  return out
}

/** The block drawer a template contributed for a block type, or null. */
export function contributedBlock(type) {
  for (const m of registry.values()) if (m.blocks && m.blocks[type]) return m.blocks[type]
  return null
}

export function contributedBlockTypes() {
  return viewModules().flatMap((m) => Object.keys(m.blocks || {}))
}

for (const mod of [profile, actions, social, gallery, menu, listings, availability, profileEditor, mediaManager, menuEditor, listingManager, availabilityCalendar]) registerView(mod)
