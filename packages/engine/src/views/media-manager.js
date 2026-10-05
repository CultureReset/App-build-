// Admin template: media-manager — the photos as a grid the owner reorders,
// captions, marks as cover and removes. "Add" is the image field: a link, or
// a file where the screen can upload (EngineApp with an owner adapter sends
// it to gcr-api-clean's /business/media/upload and writes the url it gets).

import { editorBlocks, editDeleteButtons, imageSlot, isOn, moveButtons, rawValue, rowId, slot } from '../view-helpers.js'
import { fill } from '../copy.js'

const template = {
  name: 'media-manager',
  surface: 'owner',
  summary: 'Photos as a grid: add, reorder, caption, pick the cover, remove.',
  spec: {
    slots: ['image', 'caption', 'cover'],
    required: ['image'],
    slotTypes: { cover: 'boolean' },
  },
  tokens: ['--ng-media-manager-gap', '--ng-media-manager-min', '--ng-media-manager-ratio', '--ng-media-manager-radius', '--ng-media-manager-cover-outline', '--ng-media-manager-actions-gap'],
  render(ctx, view, { sourceKey, source, rows }) {
    const can = ctx.can(source)
    const blocks = [{ type: 'text', tone: 'muted', text: rows.length === 1 ? ctx.copy.countOne : fill(ctx.copy.count, { n: rows.length }) }]
    if (!can.write && source.from === 'business') blocks.push({ type: 'notice', tone: 'muted', text: ctx.copy.readOnly })
    blocks.push(...editorBlocks(ctx, sourceKey, source, rows, { can }))
    const coverKey = view.fields?.cover
    const items = []
    rows.forEach((row, i) => {
      const caption = slot(ctx, sourceKey, source, view, 'caption', row)
      const image = imageSlot(view, 'image', row, caption || source.labelSingular)
      if (!image) return
      const id = rowId(row, i)
      const item = { id, ...image }
      if (caption) item.caption = caption
      const cover = coverKey ? isOn(rawValue(view, 'cover', row)) : false
      if (cover) item.cover = true
      if (can.write) {
        item.actions = moveButtons(ctx, sourceKey, source, id, i, rows.length)
        if (coverKey && !cover) item.actions.push({ label: ctx.copy.setCover, style: 'secondary', action: { type: 'record.update', source: sourceKey, id, values: { [coverKey]: true } } })
        item.actions.push(...editDeleteButtons(ctx, sourceKey, id))
      }
      items.push(item)
    })
    blocks.push(items.length ? { type: 'gallery', style: 'grid', items } : { type: 'empty', text: view.emptyText || ctx.copy.empty })
    return blocks
  },
}

export default template
