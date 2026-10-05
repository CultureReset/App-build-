// Template: listings — cards with image, title, kind badge, badges (a tags
// field), price per unit and capacity, a filter by kind and a detail view. "Kind" is whatever the business
// keeps in that field; the filter is built from the values present.

import { display, fieldOf, groupedByValue, imageSlot, linkSlot, listSlot, rowId, section, slot } from '../view-helpers.js'
import { fill } from '../copy.js'

const template = {
  name: 'listings',
  surface: 'public',
  summary: 'Cards with image, title, kind badge, badges, price per unit and capacity; filter by kind; a detail view.',
  spec: {
    slots: ['title', 'image', 'kind', 'badges', 'price', 'unit', 'capacity', 'description', 'link'],
    defaultSlot: 'title',
    styles: ['grid', 'list'],
  },
  tokens: [
    '--ng-listings-gap', '--ng-listings-min', '--ng-listings-card-padding', '--ng-listings-card-radius', '--ng-listings-card-bg', '--ng-listings-card-border',
    '--ng-listings-image-ratio', '--ng-listings-image-radius', '--ng-listings-title-size', '--ng-listings-title-weight', '--ng-listings-price-size',
    '--ng-listings-price-weight', '--ng-listings-price-color', '--ng-listings-badge-bg', '--ng-listings-badge-color', '--ng-listings-badge-radius',
    '--ng-listings-meta-color', '--ng-listings-hidden-opacity',
  ],
  render(ctx, view, { sourceKey, source, rows }) {
    return listingBlocks(ctx, view, { sourceKey, source, rows, style: view.style === 'list' ? 'listings-rows' : 'listings' })
  },
}

/** Shared with listing-manager: grouped by kind, a filter nav when more than one, cards. `decorate(item, row, i, group)` adds owner controls. */
export function listingBlocks(ctx, view, { sourceKey, source, rows, style, decorate }) {
  const titleKey = view.fields?.title || source.title
  const kindField = view.fields?.kind ? fieldOf(source, view.fields.kind) : null
  const toItem = (row, i, group) => {
    const item = { id: rowId(row, i), title: display(ctx, sourceKey, fieldOf(source, titleKey), row) }
    const kind = slot(ctx, sourceKey, source, view, 'kind', row)
    if (kind) item.badge = kind
    const badges = listSlot(view, 'badges', row)
    if (badges.length) item.badges = badges
    const price = slot(ctx, sourceKey, source, view, 'price', row)
    const unit = slot(ctx, sourceKey, source, view, 'unit', row)
    if (price) item.value = unit ? fill(ctx.copy.priceUnit, { price, unit }) : price
    else if (unit) item.subtitle = unit
    const capacity = slot(ctx, sourceKey, source, view, 'capacity', row)
    if (capacity) item.meta = [fill(ctx.copy.upTo, { n: capacity })]
    const body = slot(ctx, sourceKey, source, view, 'description', row)
    if (body) item.body = body
    const image = imageSlot(view, 'image', row, item.title)
    if (image) item.image = image
    const href = linkSlot(view, 'link', row)
    if (href) item.href = href
    if (body || image) item.detail = true
    if (decorate) decorate(item, row, i, group)
    return item
  }
  const groups = groupedByValue(ctx, sourceKey, source, kindField, rows)
  if (groups.length === 1 && !groups[0].label) return groups[0].rows.length ? [{ type: 'list', style, items: groups[0].rows.map((r, i) => toItem(r, i, groups[0])) }] : []
  const anchor = (g) => `${sourceKey}-${g.key === '__other' ? 'other' : g.key}`
  const out = []
  if (groups.length > 1) out.push({ type: 'nav', style: 'filter', items: groups.map((g) => ({ label: g.label, target: anchor(g) })) })
  for (const g of groups) out.push(section(g.label, [{ type: 'list', style, items: g.rows.map((r, i) => toItem(r, i, g)) }], { id: anchor(g) }))
  return out
}

export default template
