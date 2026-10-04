// Blocks → plain HTML, for the public block served server-side or as a
// static page (gcr-unified's prerender, an app's own link, a no-JS visitor).
//
// Everything is escaped. Links and image sources were already restricted by
// the renderer; they are checked again here, so a block tree from anywhere
// cannot put a javascript: URL on a page. Class names are `${prefix}-<type>`
// so each screen styles the blocks its own way.

import { LINK_SCHEMES } from './values.js'

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
  const cls = (name, extra) => `${prefix}-${name}${extra ? ` ${prefix}-${name}--${extra}` : ''}`
  const out = []

  const link = (href, inner, className) =>
    okHref(href)
      ? `<a class="${className}" href="${escapeHtml(href)}" rel="noopener noreferrer nofollow ugc" target="_blank">${inner}</a>`
      : `<span class="${className}">${inner}</span>`

  const button = (b) => {
    const style = escapeHtml(b.style || 'primary')
    const icon = b.icon ? `<span class="${prefix}-icon" aria-hidden="true">${escapeHtml(b.icon)}</span>` : ''
    const label = `<span class="${prefix}-label">${escapeHtml(b.label)}</span>`
    const note = b.note ? `<span class="${prefix}-note">${escapeHtml(b.note)}</span>` : ''
    if (b.href) return link(b.href, `${icon}${label}${note}`, `${cls('button', style)}`)
    // Actions need a live screen; static HTML shows the label only.
    return `<span class="${cls('button', style)}" aria-disabled="true">${icon}${label}</span>`
  }

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
    return `<label class="${cls('field', f.type)}" for="${id}"><span class="${prefix}-field-label">${escapeHtml(f.label)}</span>${control}${help}${err}</label>`
  }

  const walk = (list, depth) => {
    for (const b of list || []) {
      switch (b.type) {
        case 'section': {
          const level = Math.min(6, base + depth)
          out.push(`<section class="${cls('section')}">`)
          if (b.title) out.push(`<h${level} class="${prefix}-section-title">${escapeHtml(b.title)}</h${level}>`)
          walk(b.blocks, depth + 1)
          out.push('</section>')
          break
        }
        case 'heading': {
          const level = Math.min(6, base + b.level - 1)
          out.push(`<h${level} class="${cls('heading')}">${escapeHtml(b.text)}</h${level}>`)
          break
        }
        case 'text':
          out.push(`<p class="${cls('text', b.tone)}">${escapeHtml(b.text)}</p>`)
          break
        case 'notice':
          out.push(`<p class="${cls('notice', b.tone)}" role="status">${escapeHtml(b.text)}</p>`)
          break
        case 'empty':
          out.push(`<p class="${cls('empty')}">${escapeHtml(b.text)}</p>`)
          break
        case 'divider':
          out.push(`<hr class="${cls('divider')}">`)
          break
        case 'list': {
          out.push(`<ul class="${cls('list', b.style)}">`)
          for (const it of b.items || []) {
            const parts = []
            if (it.image && okSrc(it.image.src)) parts.push(`<img class="${prefix}-item-image" src="${escapeHtml(it.image.src)}" alt="${escapeHtml(it.image.alt || '')}" loading="lazy">`)
            parts.push(`<span class="${prefix}-item-title">${escapeHtml(it.title)}</span>`)
            if (it.badge) parts.push(`<span class="${prefix}-item-badge">${escapeHtml(it.badge)}</span>`)
            if (it.value) parts.push(`<span class="${prefix}-item-value">${escapeHtml(it.value)}</span>`)
            if (it.subtitle) parts.push(`<span class="${prefix}-item-subtitle">${escapeHtml(it.subtitle)}</span>`)
            if (it.meta?.length) parts.push(`<span class="${prefix}-item-meta">${it.meta.map(escapeHtml).join(' · ')}</span>`)
            if (it.body) parts.push(`<span class="${prefix}-item-body">${escapeHtml(it.body)}</span>`)
            if (it.time) parts.push(`<span class="${prefix}-item-time">${escapeHtml(it.time)}</span>`)
            const inner = parts.join('')
            out.push(`<li class="${prefix}-item">${it.href ? link(it.href, inner, `${prefix}-item-link`) : inner}</li>`)
          }
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
          out.push(`<ul class="${cls('images', b.style)}">`)
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
          out.push(`<div class="${cls('buttons', b.style)}">${(b.items || []).map(button).join('')}</div>`)
          break
        case 'details':
          if (b.style === 'list') {
            out.push(`<dl class="${cls('details', 'list')}">`)
            for (const it of b.items || []) out.push(`<dt>${escapeHtml(it.summary)}</dt><dd>${escapeHtml(it.body)}</dd>`)
            out.push('</dl>')
          } else {
            out.push(`<div class="${cls('details', 'accordion')}">`)
            for (const it of b.items || []) out.push(`<details><summary>${escapeHtml(it.summary)}</summary><p>${escapeHtml(it.body)}</p></details>`)
            out.push('</div>')
          }
          break
        case 'embed':
          if (okSrc(b.src, true)) {
            out.push(`<div class="${cls('embed')}"><iframe src="${escapeHtml(b.src)}" title="${escapeHtml(b.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`)
          }
          break
        case 'form': {
          const target = typeof options.formAction === 'function' ? options.formAction(b.submit?.action, b) : null
          const attrs = target ? ` method="post" action="${escapeHtml(target)}"` : ''
          out.push(`<form class="${cls('form', b.style)}"${attrs}>`)
          if (b.intro) out.push(`<p class="${prefix}-form-intro">${escapeHtml(b.intro)}</p>`)
          if (b.errors?._form) out.push(`<p class="${prefix}-error" role="alert">${escapeHtml(b.errors._form)}</p>`)
          for (const f of b.fields || []) out.push(field(f, b.values?.[f.key], b.errors?.[f.key], b.id))
          if (!b.readOnly) out.push(`<button type="submit" class="${cls('button', 'primary')}"${target ? '' : ' disabled'}>${escapeHtml(b.submit?.label || '')}</button>`)
          out.push('</form>')
          break
        }
        default:
          // Unknown block types are skipped, so an older screen survives a newer engine.
          break
      }
    }
  }

  walk(blocks, 0)
  return out.join('')
}
