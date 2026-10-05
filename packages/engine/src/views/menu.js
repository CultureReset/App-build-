// Template: menu — sections as a sticky category nav, item cards with photo,
// price, description and badges, a sold-out state and an item detail.
// Mobile-first: the nav scrolls sideways, cards stack. Any source with a
// `group` select (its sections) and a price fits; nothing here is tied to one app.

import { display, fieldOf, grouped, imageSlot, listSlot, rawValue, isOn, rowId, section, slot } from '../view-helpers.js'

const LIST_STYLE = { cards: 'menu', rows: 'menu-compact' }

const template = {
  name: 'menu',
  surface: 'public',
  summary: 'Sections as a sticky category nav; item cards with photo, price, description, badges and sold-out state.',
  spec: {
    slots: ['title', 'description', 'price', 'image', 'badges', 'available'],
    defaultSlot: 'title',
    slotTypes: { available: 'boolean' },
    styles: Object.keys(LIST_STYLE),
  },
  tokens: [
    '--ng-menu-gap', '--ng-menu-card-padding', '--ng-menu-card-radius', '--ng-menu-card-bg', '--ng-menu-card-border',
    '--ng-menu-image-size', '--ng-menu-image-ratio', '--ng-menu-image-radius', '--ng-menu-title-size', '--ng-menu-title-weight',
    '--ng-menu-price-size', '--ng-menu-price-weight', '--ng-menu-price-color', '--ng-menu-description-size', '--ng-menu-description-color',
    '--ng-menu-badge-bg', '--ng-menu-badge-color', '--ng-menu-badge-radius', '--ng-menu-soldout-opacity', '--ng-menu-soldout-decoration',
    '--ng-menu-section-size', '--ng-menu-detail-image-ratio',
  ],
  render(ctx, view, { sourceKey, source, rows, allRows }) {
    // When the view marks sold-out items, they stay on the menu instead of vanishing.
    const availableKey = view.fields?.available
    const list = availableKey && availableKey === source.visibleWhen ? allRows : rows
    const titleKey = view.fields?.title || source.title
    const style = LIST_STYLE[view.style] || LIST_STYLE.cards
    const toItem = (row, i) => {
      const item = { id: rowId(row, i), title: display(ctx, sourceKey, fieldOf(source, titleKey), row) }
      const body = slot(ctx, sourceKey, source, view, 'description', row)
      if (body) item.body = body
      const price = slot(ctx, sourceKey, source, view, 'price', row)
      if (price) item.value = price
      const image = imageSlot(view, 'image', row, item.title)
      if (image) item.image = image
      const badges = listSlot(view, 'badges', row)
      if (availableKey && !isOn(rawValue(view, 'available', row))) {
        item.unavailable = true
        badges.push(ctx.copy.soldOut)
      }
      if (badges.length) item.badges = badges
      if (body || image) item.detail = true
      return item
    }
    const groups = grouped(ctx, sourceKey, source, list)
    if (groups.length === 1 && !groups[0].label) return groups[0].rows.length ? [{ type: 'list', style, items: groups[0].rows.map(toItem) }] : []
    const anchor = (g) => `${sourceKey}-${g.key === '__other' ? 'other' : g.key}`
    const out = []
    if (groups.length > 1) out.push({ type: 'nav', style: 'anchors', items: groups.map((g) => ({ label: g.label, target: anchor(g) })) })
    for (const g of groups) out.push(section(g.label, [{ type: 'list', style, items: g.rows.map(toItem) }], { id: anchor(g) }))
    return out
  },
}

export default template
