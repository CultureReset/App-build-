// Template: profile — a business's header: who it is, where, how to reach it.
// Draws the first row of its source (business.profile has one). The `profile`
// block is only ever emitted here, so its drawers live here too.

import { display, fieldOf, imageSlot, slot, contactButtons } from '../view-helpers.js'

const STYLES = ['card', 'banner', 'compact']

const template = {
  name: 'profile',
  surface: 'public',
  summary: 'Name, tagline, description, location, logo and cover, with the ways to get in touch.',
  spec: {
    slots: ['name', 'tagline', 'description', 'location', 'image', 'cover', 'phone', 'sms', 'email', 'link', 'book', 'directions'],
    styles: STYLES,
    defaultSlot: 'name',
    single: true,
  },
  tokens: [
    '--ng-profile-gap', '--ng-profile-padding', '--ng-profile-radius', '--ng-profile-bg', '--ng-profile-border',
    '--ng-profile-image-size', '--ng-profile-image-radius', '--ng-profile-cover-height', '--ng-profile-cover-radius',
    '--ng-profile-name-size', '--ng-profile-name-weight', '--ng-profile-tagline-size', '--ng-profile-tagline-color',
    '--ng-profile-text-size', '--ng-profile-location-color', '--ng-profile-actions-gap', '--ng-profile-align',
  ],
  render(ctx, view, { sourceKey, source, rows }) {
    const row = rows[0]
    if (!row) return []
    const nameKey = view.fields?.name || source.title
    const block = { type: 'profile', style: STYLES.includes(view.style) ? view.style : STYLES[0], name: display(ctx, sourceKey, fieldOf(source, nameKey), row) }
    if (!block.name) return []
    for (const name of ['tagline', 'description', 'location']) {
      const text = slot(ctx, sourceKey, source, view, name, row)
      if (text) block[name] = text
    }
    const image = imageSlot(view, 'image', row, block.name)
    if (image) block.image = image
    const cover = imageSlot(view, 'cover', row, '')
    if (cover) block.cover = cover
    const actions = contactButtons(ctx, view, row)
    if (actions.length) block.actions = actions
    return [block]
  },
  blocks: {
    profile: {
      check(b, p, out, { checkButton }) {
        if (typeof b.name !== 'string') out.push(`${p}: needs a name`)
        if (b.style !== undefined && !STYLES.includes(b.style)) out.push(`${p}: unknown profile style`)
        for (const k of ['tagline', 'description', 'location']) if (b[k] !== undefined && typeof b[k] !== 'string') out.push(`${p}: ${k} must be text`)
        for (const k of ['image', 'cover']) if (b[k] !== undefined && (!b[k] || typeof b[k].src !== 'string')) out.push(`${p}: ${k} needs src`)
        if (b.actions !== undefined && !Array.isArray(b.actions)) out.push(`${p}: actions is a list of buttons`)
        ;(b.actions || []).forEach((a, i) => checkButton(a, `${p}.actions[${i}]`, out))
      },
      html(b, h) {
        const parts = []
        if (b.cover && h.okSrc(b.cover.src)) parts.push(`<img class="${h.prefix}-profile-cover" src="${h.escape(b.cover.src)}" alt="${h.escape(b.cover.alt || '')}" loading="lazy">`)
        parts.push(`<div class="${h.prefix}-profile-body">`)
        if (b.image && h.okSrc(b.image.src)) parts.push(`<img class="${h.prefix}-profile-image" src="${h.escape(b.image.src)}" alt="${h.escape(b.image.alt || '')}" loading="lazy">`)
        parts.push(`<div class="${h.prefix}-profile-text">`)
        parts.push(`<${h.headingTag} class="${h.prefix}-profile-name">${h.escape(b.name)}</${h.headingTag}>`)
        if (b.tagline) parts.push(`<p class="${h.prefix}-profile-tagline">${h.escape(b.tagline)}</p>`)
        if (b.location) parts.push(`<p class="${h.prefix}-profile-location">${h.escape(b.location)}</p>`)
        if (b.description) parts.push(`<p class="${h.prefix}-profile-description">${h.escape(b.description)}</p>`)
        parts.push('</div>')
        if (b.actions?.length) parts.push(`<div class="${h.prefix}-profile-actions">${b.actions.map(h.button).join('')}</div>`)
        parts.push('</div>')
        return `<header class="${h.cls('profile', b.style, STYLES)}">${parts.join('')}</header>`
      },
      react(b, r) {
        const { h, p } = r
        return h(
          'header',
          { className: `${p}-profile ${p}-profile--${STYLES.includes(b.style) ? b.style : STYLES[0]}` },
          b.cover && r.okImg(b.cover.src) ? h('img', { className: `${p}-profile-cover`, src: b.cover.src, alt: b.cover.alt || '', loading: 'lazy' }) : null,
          h(
            'div',
            { className: `${p}-profile-body` },
            b.image && r.okImg(b.image.src) ? h('img', { className: `${p}-profile-image`, src: b.image.src, alt: b.image.alt || '', loading: 'lazy' }) : null,
            h(
              'div',
              { className: `${p}-profile-text` },
              h(r.headingTag, { className: `${p}-profile-name` }, b.name),
              b.tagline ? h('p', { className: `${p}-profile-tagline` }, b.tagline) : null,
              b.location ? h('p', { className: `${p}-profile-location` }, b.location) : null,
              b.description ? h('p', { className: `${p}-profile-description` }, b.description) : null,
            ),
            b.actions?.length ? h('div', { className: `${p}-profile-actions` }, b.actions.map((a, i) => h(r.Button, { key: i, b: a, p, onAction: r.onAction, busy: r.busy }))) : null,
          ),
        )
      },
    },
  },
}

export default template
