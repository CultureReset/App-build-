// Blocks → plain HTML, for the public block served server-side or as a
// static page (gcr-unified's prerender, an app's own link, a no-JS visitor).
//
// Everything is escaped. Links and image sources were already restricted by
// the renderer; they are checked again here, so a block tree from anywhere
// cannot put a javascript: URL on a page. Class names are `${prefix}-<type>`
// so each screen styles the blocks its own way.

import { LINK_SCHEMES } from './values.js'
import { BUTTON_STYLES, BUTTONS_STYLES, CALENDAR_STYLES, DETAILS_STYLES, FORM_STYLES, GALLERY_STYLES, HEADING_LEVELS, IMAGES_STYLES, INPUT_TYPES, KEY, LIST_STYLES, NAV_STYLES, TONES } from './blocks.js'
import { contributedBlock } from './views/index.js'
import { slug } from './view-helpers.js'

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESC[ch])
}

function okHref(href) {
  try {
    return LINK_SCHEMES.includes(new URL(String(href)).protocol)
  } catch {
    return false
  }
}

function okSrc(src, https = false) {
  try {
    const p = new URL(String(src)).protocol
    return https ? p === 'https:' : p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

const INPUT = { email: 'email', phone: 'tel', number: 'number', money: 'number', date: 'date', time: 'time', url: 'url', image: 'url', color: 'color', secret: 'password' }

/**
 * @param {object[]} blocks
 * @param {{ prefix?: string, formAction?: (action: object, form: object) => string | null, headingBase?: number }} [options]
 *   formAction: where a <form> posts. Return null and the form is drawn
 *   without a submit target (shown, but inert) — e.g. a static snapshot.
 */
export function renderHtml(blocks, options = {}) {
  const prefix = options.prefix || 'ng'
  const base = options.headingBase || 2
  // A modifier class comes only from the block vocabulary (blocks.js): an
  // unknown value is dropped, and whatever is emitted is escaped as well.
  const cls = (name, extra, allowed) => {
    const modifier = extra !== undefined && (!allowed || allowed.includes(extra)) ? escapeHtml(extra) : ''
    return `${prefix}-${name}${modifier ? ` ${prefix}-${name}--${modifier}` : ''}`
  }
  const out = []

  const link = (href, inner, className) =>
    okHref(href)
      ? `<a class="${className}" href="${escapeHtml(href)}" rel="noopener noreferrer nofollow ugc" target="_blank">${inner}</a>`
      : `<span class="${className}">${inner}</span>`

  // A key from data (a button's or an entry's) reaches a class only slugged.
  const keyClass = (name, key) => (typeof key === 'string' && KEY.test(key) ? ` ${prefix}-${name}-${slug(key)}` : '')
  const anchorId = (id) => `${prefix}-${slug(id)}`

  const button = (b) => {
    const style = BUTTON_STYLES.includes(b.style) ? b.style : 'primary'
    const icon = b.icon ? `<span class="${prefix}-icon" aria-hidden="true">${escapeHtml(b.icon)}</span>` : ''
    const label = `<span class="${prefix}-label">${escapeHtml(b.label)}</span>`
    const note = b.note ? `<span class="${prefix}-note">${escapeHtml(b.note)}</span>` : ''
    const className = `${cls('button', style, BUTTON_STYLES)}${keyClass('key', b.key)}`
    if (b.href) return link(b.href, `${icon}${label}${note}`, className)
    // Actions need a live screen; static HTML shows the label only.
    return `<span class="${className}" aria-disabled="true">${icon}${label}</span>`
  }
  const buttonRow = (list, className) => (list?.length ? `<div class="${className}">${list.map(button).join('')}</div>` : '')

  const field = (f, value, error, formId) => {
    const id = `${prefix}-${escapeHtml(formId)}-${escapeHtml(f.key)}`.replace(/[^A-Za-z0-9_-]/g, '-')
    const name = escapeHtml(f.key)
    const req = f.required ? ' required' : ''
    const v = value === undefined || value === null ? '' : value
    let control
    if (f.type === 'longtext') {
      control = `<textarea id="${id}" name="${name}"${req}${f.maxLength ? ` maxlength="${Number(f.maxLength)}"` : ''}${f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : ''}>${escapeHtml(v)}</textarea>`
    } else if (f.type === 'select') {
      const opts = (f.options || []).map((o) => `<option value="${escapeHtml(o.value)}"${String(o.value) === String(v) ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')
      control = `<select id="${id}" name="${name}"${req}><option value=""></option>${opts}</select>`
    } else if (f.type === 'boolean') {
      control = `<input id="${id}" name="${name}" type="checkbox" value="true"${v === true || v === 'true' ? ' checked' : ''}>`
    } else {
      const type = INPUT[f.type] || 'text'
      const step = f.type === 'money' ? ' step="0.01"' : ''
      const bounds = `${f.min !== undefined ? ` min="${Number(f.min)}"` : ''}${f.max !== undefined ? ` max="${Number(f.max)}"` : ''}`
      const value = f.type === 'secret' ? '' : ` value="${escapeHtml(v)}"`
      control = `<input id="${id}" name="${name}" type="${type}"${value}${req}${step}${bounds}${f.maxLength ? ` maxlength="${Number(f.maxLength)}"` : ''}${f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : ''}>`
    }
    const help = f.help ? `<span class="${prefix}-help">${escapeHtml(f.help)}</span>` : ''
    const err = error ? `<span class="${prefix}-error" role="alert">${escapeHtml(error)}</span>` : ''
    return `<label class="${cls('field', f.type, INPUT_TYPES)}" for="${id}"><span class="${prefix}-field-label">${escapeHtml(f.label)}</span>${control}${help}${err}</label>`
  }

  const form = (b) => {
    const target = typeof options.formAction === 'function' ? options.formAction(b.submit?.action, b) : null
    const attrs = target ? ` method="post" action="${escapeHtml(target)}"` : ''
    const parts = [`<form class="${cls('form', b.style, FORM_STYLES)}"${attrs}>`]
    if (b.intro) parts.push(`<p class="${prefix}-form-intro">${escapeHtml(b.intro)}</p>`)
    if (b.errors?._form) parts.push(`<p class="${prefix}-error" role="alert">${escapeHtml(b.errors._form)}</p>`)
    for (const f of b.fields || []) parts.push(field(f, b.values?.[f.key], b.errors?.[f.key], b.id))
    if (!b.readOnly) parts.push(`<button type="submit" class="${cls('button', 'primary', BUTTON_STYLES)}"${target ? '' : ' disabled'}>${escapeHtml(b.submit?.label || '')}</button>`)
    parts.push('</form>')
    return parts.join('')
  }

  const img = (it, className) => `<img${className ? ` class="${className}"` : ''} src="${escapeHtml(it.src)}" alt="${escapeHtml(it.alt || '')}" loading="lazy">`

  // A list item: the card, or — with `detail` — a card that opens (<details>) on its full text and photo.
  const listItem = (it) => {
    const head = []
    if (it.image && okSrc(it.image.src)) head.push(img(it.image, `${prefix}-item-image`))
    head.push(`<span class="${prefix}-item-title">${escapeHtml(it.title)}</span>`)
    if (it.badge) head.push(`<span class="${prefix}-item-badge">${escapeHtml(it.badge)}</span>`)
    if (it.badges?.length) head.push(`<span class="${prefix}-item-badges">${it.badges.map((x) => `<span class="${prefix}-item-badge">${escapeHtml(x)}</span>`).join('')}</span>`)
    if (it.value) head.push(`<span class="${prefix}-item-value">${escapeHtml(it.value)}</span>`)
    if (it.subtitle) head.push(`<span class="${prefix}-item-subtitle">${escapeHtml(it.subtitle)}</span>`)
    if (it.meta?.length) head.push(`<span class="${prefix}-item-meta">${it.meta.map(escapeHtml).join(' · ')}</span>`)
    if (it.time) head.push(`<span class="${prefix}-item-time">${escapeHtml(it.time)}</span>`)
    const body = it.body ? `<span class="${prefix}-item-body">${escapeHtml(it.body)}</span>` : ''
    let inner
    if (it.detail) {
      const more = `${it.image && okSrc(it.image.src) ? img(it.image, `${prefix}-item-detail-image`) : ''}${body}`
      inner = `<details class="${prefix}-item-detail"><summary class="${prefix}-item-card">${head.join('')}</summary><div class="${prefix}-item-more">${more}</div></details>`
    } else {
      inner = `<span class="${prefix}-item-card">${head.join('')}${body}</span>`
    }
    const tail = `${it.form ? `<div class="${prefix}-item-form">${form(it.form)}</div>` : ''}${buttonRow(it.actions, `${prefix}-item-actions`)}`
    const className = `${prefix}-item${it.unavailable ? ` ${prefix}-item--unavailable` : ''}`
    return `<li class="${className}">${it.href && !it.detail ? link(it.href, inner, `${prefix}-item-link`) : inner}${tail}</li>`
  }

  let galleries = 0
  const walk = (list, depth) => {
    for (const b of list || []) {
      switch (b.type) {
        case 'section': {
          const level = Math.min(6, base + depth)
          out.push(`<section class="${cls('section')}"${typeof b.id === 'string' ? ` id="${anchorId(b.id)}"` : ''}>`)
          if (b.title || b.actions?.length) {
            out.push(`<div class="${prefix}-section-head">`)
            if (b.title) out.push(`<h${level} class="${prefix}-section-title">${escapeHtml(b.title)}</h${level}>`)
            out.push(buttonRow(b.actions, `${prefix}-section-actions`))
            out.push('</div>')
          }
          walk(b.blocks, depth + 1)
          out.push('</section>')
          break
        }
        case 'nav':
          out.push(`<nav class="${cls('nav', b.style, NAV_STYLES)}">`)
          for (const it of b.items || []) out.push(`<a class="${prefix}-nav-item" href="#${anchorId(it.target)}">${escapeHtml(it.label)}</a>`)
          out.push('</nav>')
          break
        case 'gallery': {
          // The lightbox is :target based (styles.css), so it works without a script.
          const g = galleries++
          const items = (b.items || []).filter((it) => okSrc(it.src))
          out.push(`<ul class="${cls('gallery', b.style, GALLERY_STYLES)}">`)
          items.forEach((it, i) => {
            const id = `${prefix}-lb-${g}-${i}`
            const cap = it.caption ? `<figcaption>${escapeHtml(it.caption)}</figcaption>` : ''
            out.push(`<li class="${prefix}-gallery-item${it.cover ? ` ${prefix}-gallery-item--cover` : ''}"><a class="${prefix}-gallery-open" href="#${id}"><figure>${img(it)}${cap}</figure></a>${buttonRow(it.actions, `${prefix}-item-actions`)}</li>`)
          })
          out.push('</ul>')
          items.forEach((it, i) => {
            const id = `${prefix}-lb-${g}-${i}`
            const cap = it.caption ? `<figcaption>${escapeHtml(it.caption)}</figcaption>` : ''
            const prev = `<a class="${prefix}-lightbox-prev" href="#${prefix}-lb-${g}-${(i + items.length - 1) % items.length}" aria-label="previous">‹</a>`
            const next = `<a class="${prefix}-lightbox-next" href="#${prefix}-lb-${g}-${(i + 1) % items.length}" aria-label="next">›</a>`
            const open = it.href ? link(it.href, escapeHtml(it.href), `${prefix}-lightbox-link`) : ''
            out.push(`<div class="${prefix}-lightbox" id="${id}" role="dialog"><a class="${prefix}-lightbox-close" href="#${prefix}-lb-${g}" aria-label="close">×</a>${prev}<figure>${img(it)}${cap}${open}</figure>${next}</div>`)
          })
          out.push(`<span id="${prefix}-lb-${g}"></span>`)
          break
        }
        case 'calendar': {
          const style = CALENDAR_STYLES.includes(b.style) ? b.style : 'list'
          out.push(`<div class="${cls('calendar', style, CALENDAR_STYLES)}">`)
          if (b.title) out.push(`<p class="${prefix}-calendar-title">${escapeHtml(b.title)}</p>`)
          if (style !== 'list') out.push(`<ol class="${prefix}-weekdays">${(b.weekdays || []).map((w) => `<li class="${prefix}-weekday">${escapeHtml(w)}</li>`).join('')}</ol>`)
          out.push(`<ol class="${prefix}-days">`)
          ;(b.days || []).forEach((d, i) => {
            const col = i === 0 && style === 'month' && Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6 ? ` style="grid-column-start: ${d.weekday + 1}"` : ''
            const cls2 = `${prefix}-day${d.today ? ` ${prefix}-day--today` : ''}${d.entries?.length ? ` ${prefix}-day--busy` : ''}`
            out.push(`<li class="${cls2}"${col}><span class="${prefix}-day-label">${escapeHtml(d.label)}</span>`)
            if (d.entries?.length) {
              out.push(`<ul class="${prefix}-entries">`)
              for (const e of d.entries) {
                const parts = []
                if (e.time) parts.push(`<span class="${prefix}-entry-time">${escapeHtml(e.time)}</span>`)
                if (e.title) parts.push(`<span class="${prefix}-entry-title">${escapeHtml(e.title)}</span>`)
                if (e.status) parts.push(`<span class="${prefix}-entry-status">${escapeHtml(e.status)}</span>`)
                if (typeof e.capacity === 'number') parts.push(`<span class="${prefix}-entry-capacity">${escapeHtml(e.capacity)}</span>`)
                const inner = parts.join('')
                out.push(`<li class="${prefix}-entry${keyClass('entry', e.key)}">${e.href ? link(e.href, inner, `${prefix}-entry-link`) : inner}${buttonRow(e.actions, `${prefix}-item-actions`)}</li>`)
              }
              out.push('</ul>')
            }
            out.push(`${buttonRow(d.actions, `${prefix}-day-actions`)}</li>`)
          })
          out.push('</ol></div>')
          break
        }
        case 'heading': {
          const level = Math.min(6, base + (HEADING_LEVELS.includes(b.level) ? b.level : HEADING_LEVELS[0]) - 1)
          out.push(`<h${level} class="${cls('heading')}">${escapeHtml(b.text)}</h${level}>`)
          break
        }
        case 'text':
          out.push(`<p class="${cls('text', b.tone, TONES)}">${escapeHtml(b.text)}</p>`)
          break
        case 'notice':
          out.push(`<p class="${cls('notice', b.tone, TONES)}" role="status">${escapeHtml(b.text)}</p>`)
          break
        case 'empty':
          out.push(`<p class="${cls('empty')}">${escapeHtml(b.text)}</p>`)
          break
        case 'divider':
          out.push(`<hr class="${cls('divider')}">`)
          break
        case 'list': {
          out.push(`<ul class="${cls('list', b.style, LIST_STYLES)}">`)
          for (const it of b.items || []) out.push(listItem(it))
          out.push('</ul>')
          break
        }
        case 'table': {
          out.push(`<table class="${cls('table')}"><thead><tr>`)
          for (const c of b.columns || []) out.push(`<th scope="col">${escapeHtml(c.label)}</th>`)
          out.push('</tr></thead><tbody>')
          if (!(b.rows || []).length && b.empty) out.push(`<tr><td colspan="${(b.columns || []).length || 1}">${escapeHtml(b.empty)}</td></tr>`)
          for (const r of b.rows || []) {
            out.push('<tr>')
            for (const c of b.columns || []) out.push(`<td>${escapeHtml(r.cells?.[c.key] ?? '')}</td>`)
            out.push('</tr>')
          }
          out.push('</tbody></table>')
          break
        }
        case 'image':
          if (okSrc(b.src)) {
            const img = `<img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt)}" loading="lazy">`
            const cap = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : ''
            out.push(`<figure class="${cls('image')}">${b.href ? link(b.href, img, `${prefix}-image-link`) : img}${cap}</figure>`)
          }
          break
        case 'images': {
          out.push(`<ul class="${cls('images', b.style, IMAGES_STYLES)}">`)
          for (const it of b.items || []) {
            if (!okSrc(it.src)) continue
            const img = `<img src="${escapeHtml(it.src)}" alt="${escapeHtml(it.alt)}" loading="lazy">`
            const cap = it.caption ? `<figcaption>${escapeHtml(it.caption)}</figcaption>` : ''
            out.push(`<li><figure>${it.href ? link(it.href, img, `${prefix}-image-link`) : img}${cap}</figure></li>`)
          }
          out.push('</ul>')
          break
        }
        case 'button':
          out.push(button(b))
          break
        case 'buttons':
          out.push(`<div class="${cls('buttons', b.style, BUTTONS_STYLES)}">${(b.items || []).map(button).join('')}</div>`)
          break
        case 'details':
          if (b.style === 'list') {
            out.push(`<dl class="${cls('details', 'list', DETAILS_STYLES)}">`)
            for (const it of b.items || []) out.push(`<dt>${escapeHtml(it.summary)}</dt><dd>${escapeHtml(it.body)}</dd>`)
            out.push('</dl>')
          } else {
            out.push(`<div class="${cls('details', 'accordion', DETAILS_STYLES)}">`)
            for (const it of b.items || []) out.push(`<details><summary>${escapeHtml(it.summary)}</summary><p>${escapeHtml(it.body)}</p></details>`)
            out.push('</div>')
          }
          break
        case 'embed':
          if (okSrc(b.src, true)) {
            out.push(`<div class="${cls('embed')}"><iframe src="${escapeHtml(b.src)}" title="${escapeHtml(b.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`)
          }
          break
        case 'form':
          out.push(form(b))
          break
        default: {
          // A template's own block draws through its module; anything else is
          // skipped, so an older screen survives a newer engine.
          const contributed = contributedBlock(b.type)
          if (contributed) {
            out.push(contributed.html(b, { prefix, cls, escape: escapeHtml, okSrc, okHref, link, button, buttonRow, img, form, headingTag: `h${Math.min(6, base + depth)}` }))
          }
          break
        }
      }
    }
  }

  walk(blocks, 0)
  return out.join('')
}
