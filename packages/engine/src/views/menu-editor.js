// Admin template: menu-editor — sections with their items, each item with a
// sold-out toggle, an inline price edit, edit and remove; sections and items
// reorder by their order column when the source is sortable.

import { display, editorBlocks, editDeleteButtons, fieldOf, grouped, imageSlot, inlineForm, isOn, listSlot, moveButtons, ordered, rawValue, rowId, rowsOf, section, slot, toggleButton } from '../view-helpers.js'
import { fill } from '../copy.js'

const template = {
  name: 'menu-editor',
  surface: 'owner',
  summary: 'Sections and their items: reorder, toggle sold out, edit the price in place, edit, remove.',
  spec: {
    slots: ['title', 'price', 'available', 'image', 'description', 'badges'],
    defaultSlot: 'title',
    slotTypes: { available: 'boolean' },
  },
  tokens: ['--ng-menu-editor-gap', '--ng-menu-editor-section-bg', '--ng-menu-editor-section-radius', '--ng-menu-editor-price-width', '--ng-menu-editor-actions-gap'],
  render(ctx, view, { sourceKey, source, rows }) {
    const can = ctx.can(source)
    const blocks = [{ type: 'text', tone: 'muted', text: rows.length === 1 ? ctx.copy.countOne : fill(ctx.copy.count, { n: rows.length }) }]
    if (!can.write && source.from === 'business') blocks.push({ type: 'notice', tone: 'muted', text: ctx.copy.readOnly })
    blocks.push(...editorBlocks(ctx, sourceKey, source, rows, { can }))

    const titleKey = view.fields?.title || source.title
    const availableKey = view.fields?.available
    const priceKey = view.fields?.price
    const toItem = (row, i, count) => {
      const id = rowId(row, i)
      const item = { id, title: display(ctx, sourceKey, fieldOf(source, titleKey), row) }
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
      if (can.write) {
        item.actions = moveButtons(ctx, sourceKey, source, id, i, count)
        const toggle = availableKey ? toggleButton(ctx, sourceKey, source, row, id, availableKey, { onLabel: ctx.copy.markSoldOut, offLabel: ctx.copy.markAvailable }) : null
        if (toggle) item.actions.push(toggle)
        item.actions.push(...editDeleteButtons(ctx, sourceKey, id))
        const form = priceKey ? inlineForm(ctx, sourceKey, source, row, id, priceKey) : null
        if (form) item.form = form
      }
      return item
    }

    // The sections are the group field's options source, when the group comes from one.
    const groupField = source.group ? fieldOf(source, source.group) : null
    const groupSourceKey = groupField?.optionsFrom?.source
    const groupSource = groupSourceKey ? ctx.sources[groupSourceKey] : null
    const groupRows = groupSource ? ordered(groupSource, rowsOf(ctx, groupSourceKey)) : []
    const canGroups = groupSource ? ctx.can(groupSource) : { read: false, write: false }

    const groups = grouped(ctx, sourceKey, source, rows)
    for (const g of groups) {
      const list = { type: 'list', style: 'menu-compact', items: g.rows.map((r, i) => toItem(r, i, g.rows.length)) }
      if (!g.label) {
        blocks.push(list)
        continue
      }
      const extra = { id: `${sourceKey}-${g.key === '__other' ? 'other' : g.key}` }
      const gi = groupRows.findIndex((r, i) => rowId(r, i) === g.key)
      if (groupSource && canGroups.write && gi >= 0) {
        extra.actions = [...moveButtons(ctx, groupSourceKey, groupSource, g.key, gi, groupRows.length), ...editDeleteButtons(ctx, groupSourceKey, g.key)]
      }
      blocks.push(section(g.label, [list], extra))
    }
    if (!rows.length) blocks.push({ type: 'empty', text: view.emptyText || ctx.copy.empty })
    if (groupSource) blocks.push(...editorBlocks(ctx, groupSourceKey, groupSource, groupRows, { can: canGroups }))
    return blocks
  },
}

export default template
