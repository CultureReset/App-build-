// Admin template: listing-manager — the listings as cards by kind with a kind
// filter, show/hide, reorder, edit and remove.

import { editorBlocks, editDeleteButtons, isOn, moveButtons, rowId, toggleButton } from '../view-helpers.js'
import { listingBlocks } from './listings.js'
import { fill } from '../copy.js'

const template = {
  name: 'listing-manager',
  surface: 'owner',
  summary: 'Listings as cards by kind: add, show or hide, reorder, edit, remove; filter by kind.',
  spec: {
    slots: ['title', 'image', 'kind', 'badges', 'price', 'unit', 'capacity', 'description'],
    defaultSlot: 'title',
  },
  tokens: ['--ng-listing-manager-gap', '--ng-listing-manager-min', '--ng-listing-manager-hidden-opacity', '--ng-listing-manager-actions-gap'],
  render(ctx, view, { sourceKey, source, rows }) {
    const can = ctx.can(source)
    const blocks = [{ type: 'text', tone: 'muted', text: rows.length === 1 ? ctx.copy.countOne : fill(ctx.copy.count, { n: rows.length }) }]
    if (!can.write && source.from === 'business') blocks.push({ type: 'notice', tone: 'muted', text: ctx.copy.readOnly })
    blocks.push(...editorBlocks(ctx, sourceKey, source, rows, { can }))
    const flag = source.visibleWhen
    const decorate = (item, row, i, group) => {
      const id = rowId(row, i)
      if (flag && !isOn(row[flag])) item.unavailable = true
      if (!can.write) return
      item.actions = moveButtons(ctx, sourceKey, source, id, i, group.rows.length)
      const toggle = flag ? toggleButton(ctx, sourceKey, source, row, id, flag, { onLabel: ctx.copy.hide, offLabel: ctx.copy.show }) : null
      if (toggle) item.actions.push(toggle)
      item.actions.push(...editDeleteButtons(ctx, sourceKey, id))
    }
    const cards = listingBlocks(ctx, view, { sourceKey, source, rows, style: 'listings', decorate })
    blocks.push(...(cards.length ? cards : [{ type: 'empty', text: view.emptyText || ctx.copy.empty }]))
    return blocks
  },
}

export default template
