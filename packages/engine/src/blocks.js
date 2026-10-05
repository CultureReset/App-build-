// The block vocabulary: what a renderer hands a screen to draw.
//
// Blocks are plain data (JSON-safe), in the spirit of Slack's Block Kit. A
// screen — Play-user, gcr-unified, Boxes on a TV — draws each type in its own
// style; none of them runs anything an app supplied. The list is deliberately
// small. README.md documents every type and its fields; checkBlocks() below is
// the executable version of that table.

import { contributedBlock, contributedBlockTypes } from './views/index.js'

/** The common primitives. Templates (views/*.js) may add one of their own; BLOCK_TYPES lists both. */
export const CORE_BLOCK_TYPES = [
  'section', 'heading', 'text', 'notice', 'list', 'table', 'image', 'images',
  'button', 'buttons', 'form', 'details', 'embed', 'empty', 'divider',
  'nav', 'gallery', 'calendar',
]

export const BLOCK_TYPES = new Proxy(CORE_BLOCK_TYPES, {
  get(target, prop) {
    const all = [...target, ...contributedBlockTypes()]
    const v = all[prop]
    return typeof v === 'function' ? v.bind(all) : v
  },
})

export const ACTION_TYPES = [
  'record.create', 'record.update', 'record.delete', 'record.move',
  'settings.save', 'form.submit', 'view.new', 'view.edit', 'view.cancel',
]

export const BUTTON_STYLES = ['primary', 'secondary', 'danger', 'ghost']
export const TONES = ['default', 'muted', 'success', 'warning', 'danger']
export const HEADING_LEVELS = [1, 2, 3]
export const LIST_STYLES = ['list', 'cards', 'grid', 'feed', 'menu', 'menu-compact', 'listings', 'listings-rows']
export const IMAGES_STYLES = ['grid', 'strip', 'feature']
export const BUTTONS_STYLES = ['stack', 'inline', 'grid', 'icons']
export const DETAILS_STYLES = ['accordion', 'list']
export const FORM_STYLES = ['feature']
export const NAV_STYLES = ['anchors', 'filter']
export const GALLERY_STYLES = ['grid', 'carousel']
export const CALENDAR_STYLES = ['list', 'month', 'week']
/** A key a stylesheet may target (.ng-key-<key>): lowercase, digits, dashes. */
export const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/
export const INPUT_TYPES = [
  'text', 'longtext', 'number', 'money', 'boolean', 'select', 'date', 'time',
  'email', 'phone', 'url', 'image', 'color', 'secret',
]

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string'

function checkAction(a, path, out) {
  if (!isObj(a) || !ACTION_TYPES.includes(a.type)) out.push(`${path}: unknown action`)
}

function checkButton(b, path, out) {
  if (!isObj(b) || !isStr(b.label)) return out.push(`${path}: a button needs a label`)
  if (b.style !== undefined && !BUTTON_STYLES.includes(b.style)) out.push(`${path}: unknown button style`)
  if ((b.href === undefined) === (b.action === undefined)) out.push(`${path}: a button has exactly one of href or action`)
  if (b.action !== undefined) checkAction(b.action, `${path}.action`, out)
  if (b.href !== undefined && !isStr(b.href)) out.push(`${path}: href must be text`)
  if (b.key !== undefined && !(isStr(b.key) && KEY.test(b.key))) out.push(`${path}: key is lowercase letters, digits and dashes`)
}

function checkButtons(list, path, out) {
  if (list === undefined) return
  if (!Array.isArray(list)) return out.push(`${path}: actions is a list of buttons`)
  list.forEach((a, i) => checkButton(a, `${path}[${i}]`, out))
}

/**
 * Structural check of a block tree. Returns a list of problems (empty = fine).
 * Renderers never need it at run time; tests and new screens do.
 */
export function checkBlocks(blocks, path = 'blocks', out = []) {
  if (!Array.isArray(blocks)) {
    out.push(`${path}: must be a list`)
    return out
  }
  blocks.forEach((b, i) => {
    const p = `${path}[${i}]`
    if (!isObj(b)) return out.push(`${p}: unknown block`)
    if (!CORE_BLOCK_TYPES.includes(b.type)) {
      const contributed = contributedBlock(b.type)
      if (!contributed) return out.push(`${p}: unknown block`)
      contributed.check(b, p, out, { checkButton, checkButtons, checkBlocks })
      return
    }
    switch (b.type) {
      case 'section':
        if (b.title !== undefined && !isStr(b.title)) out.push(`${p}: title must be text`)
        if (b.id !== undefined && !isStr(b.id)) out.push(`${p}: id must be text`)
        checkButtons(b.actions, `${p}.actions`, out)
        checkBlocks(b.blocks, `${p}.blocks`, out)
        break
      case 'heading':
        if (!isStr(b.text)) out.push(`${p}: needs text`)
        if (!HEADING_LEVELS.includes(b.level)) out.push(`${p}: level is 1, 2 or 3`)
        break
      case 'text':
      case 'notice':
      case 'empty':
        if (!isStr(b.text)) out.push(`${p}: needs text`)
        if (b.tone !== undefined && !TONES.includes(b.tone)) out.push(`${p}: unknown tone`)
        break
      case 'list':
        if (!LIST_STYLES.includes(b.style)) out.push(`${p}: unknown list style`)
        if (!Array.isArray(b.items)) out.push(`${p}: needs items`)
        else b.items.forEach((it, j) => {
          if (!isObj(it) || !isStr(it.title)) out.push(`${p}.items[${j}]: needs a title`)
          if (it.image !== undefined && (!isObj(it.image) || !isStr(it.image.src))) out.push(`${p}.items[${j}]: image needs src`)
          if (it.meta !== undefined && !(Array.isArray(it.meta) && it.meta.every(isStr))) out.push(`${p}.items[${j}]: meta is a list of text`)
          if (it.badges !== undefined && !(Array.isArray(it.badges) && it.badges.every(isStr))) out.push(`${p}.items[${j}]: badges is a list of text`)
          for (const flag of ['unavailable', 'detail']) if (it?.[flag] !== undefined && typeof it[flag] !== 'boolean') out.push(`${p}.items[${j}]: ${flag} is true or false`)
          if (it?.form !== undefined) checkBlocks([it.form], `${p}.items[${j}].form`, out)
          checkButtons(it?.actions, `${p}.items[${j}].actions`, out)
        })
        break
      case 'nav':
        if (!NAV_STYLES.includes(b.style)) out.push(`${p}: unknown nav style`)
        if (!Array.isArray(b.items) || !b.items.every((it) => isObj(it) && isStr(it.label) && isStr(it.target))) out.push(`${p}: items are { label, target }`)
        break
      case 'gallery':
        if (!GALLERY_STYLES.includes(b.style)) out.push(`${p}: unknown gallery style`)
        if (!Array.isArray(b.items)) out.push(`${p}: needs items`)
        else b.items.forEach((it, j) => {
          if (!isObj(it) || !isStr(it.src) || !isStr(it.alt)) out.push(`${p}.items[${j}]: needs src and alt`)
          if (it?.cover !== undefined && typeof it.cover !== 'boolean') out.push(`${p}.items[${j}]: cover is true or false`)
          checkButtons(it?.actions, `${p}.items[${j}].actions`, out)
        })
        break
      case 'calendar':
        if (!CALENDAR_STYLES.includes(b.style)) out.push(`${p}: unknown calendar style`)
        if (b.title !== undefined && !isStr(b.title)) out.push(`${p}: title must be text`)
        if (!Array.isArray(b.weekdays) || b.weekdays.length !== 7 || !b.weekdays.every(isStr)) out.push(`${p}: weekdays are seven labels`)
        if (!Array.isArray(b.days)) out.push(`${p}: needs days`)
        else b.days.forEach((d, j) => {
          const dp = `${p}.days[${j}]`
          if (!isObj(d) || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date)) || !isStr(d.label)) return out.push(`${dp}: needs date and label`)
          if (!Number.isInteger(d.weekday) || d.weekday < 0 || d.weekday > 6) out.push(`${dp}: weekday is 0 to 6`)
          checkButtons(d.actions, `${dp}.actions`, out)
          if (!Array.isArray(d.entries)) return out.push(`${dp}: needs entries`)
          d.entries.forEach((e, k) => {
            const ep = `${dp}.entries[${k}]`
            if (!isObj(e)) return out.push(`${ep}: is an object`)
            for (const t of ['title', 'time', 'status', 'href']) if (e[t] !== undefined && !isStr(e[t])) out.push(`${ep}: ${t} must be text`)
            if (e.key !== undefined && !(isStr(e.key) && KEY.test(e.key))) out.push(`${ep}: key is lowercase letters, digits and dashes`)
            if (e.capacity !== undefined && typeof e.capacity !== 'number') out.push(`${ep}: capacity is a number`)
            checkButtons(e.actions, `${ep}.actions`, out)
          })
        })
        break
      case 'table':
        if (!Array.isArray(b.columns) || !b.columns.every((c) => isObj(c) && isStr(c.key) && isStr(c.label))) out.push(`${p}: columns are { key, label }`)
        if (!Array.isArray(b.rows)) out.push(`${p}: needs rows`)
        else b.rows.forEach((r, j) => {
          if (!isObj(r) || !isObj(r.cells)) out.push(`${p}.rows[${j}]: needs cells`)
          else if (!Object.values(r.cells).every(isStr)) out.push(`${p}.rows[${j}]: cells are text`)
          ;(r?.actions || []).forEach((a, k) => checkButton(a, `${p}.rows[${j}].actions[${k}]`, out))
        })
        break
      case 'image':
        if (!isStr(b.src)) out.push(`${p}: needs src`)
        if (!isStr(b.alt)) out.push(`${p}: needs alt text`)
        break
      case 'images':
        if (!IMAGES_STYLES.includes(b.style)) out.push(`${p}: unknown images style`)
        if (!Array.isArray(b.items) || !b.items.every((it) => isObj(it) && isStr(it.src) && isStr(it.alt))) out.push(`${p}: items are { src, alt }`)
        break
      case 'button':
        checkButton(b, p, out)
        break
      case 'buttons':
        if (!BUTTONS_STYLES.includes(b.style)) out.push(`${p}: unknown buttons style`)
        if (!Array.isArray(b.items)) out.push(`${p}: needs items`)
        else b.items.forEach((it, j) => checkButton(it, `${p}.items[${j}]`, out))
        break
      case 'form':
        if (!isStr(b.id)) out.push(`${p}: needs an id`)
        if (b.style !== undefined && !FORM_STYLES.includes(b.style)) out.push(`${p}: unknown form style`)
        if (!Array.isArray(b.fields)) out.push(`${p}: needs fields`)
        else b.fields.forEach((f, j) => {
          if (!isObj(f) || !isStr(f.key) || !isStr(f.label) || !INPUT_TYPES.includes(f.type)) out.push(`${p}.fields[${j}]: needs key, label and a known type`)
        })
        if (!isObj(b.submit) || !isStr(b.submit.label)) out.push(`${p}: needs a submit label`)
        else checkAction(b.submit.action, `${p}.submit.action`, out)
        if (b.cancel !== undefined) checkButton(b.cancel, `${p}.cancel`, out)
        break
      case 'details':
        if (!DETAILS_STYLES.includes(b.style)) out.push(`${p}: unknown details style`)
        if (!Array.isArray(b.items) || !b.items.every((it) => isObj(it) && isStr(it.summary) && isStr(it.body))) out.push(`${p}: items are { summary, body }`)
        break
      case 'embed':
        if (!isStr(b.src) || !/^https:\/\//.test(b.src)) out.push(`${p}: src must be https`)
        if (!isStr(b.title)) out.push(`${p}: needs a title`)
        break
      case 'divider':
        break
    }
  })
  return out
}

/** Every block in a tree, depth first. */
export function* walkBlocks(blocks) {
  for (const b of blocks || []) {
    yield b
    if (b.type === 'section') yield* walkBlocks(b.blocks)
  }
}
