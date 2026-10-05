// Template: gallery — photos as a grid or a carousel, each opening a lightbox,
// the cover first. Emits the shared `gallery` block (blocks.js).

import { imageSlot, slot, linkSlot, rawValue, isOn, rowId } from '../view-helpers.js'

const template = {
  name: 'gallery',
  surface: 'public',
  summary: 'A grid or carousel of photos with captions and a lightbox; the cover comes first.',
  spec: {
    slots: ['image', 'caption', 'cover', 'link'],
    required: ['image'],
    slotTypes: { cover: 'boolean' },
    styles: ['grid', 'carousel'],
  },
  tokens: ['--ng-gallery-gap', '--ng-gallery-min', '--ng-gallery-ratio', '--ng-gallery-radius', '--ng-gallery-caption-size', '--ng-gallery-caption-color', '--ng-gallery-carousel-width', '--ng-gallery-lightbox-bg', '--ng-gallery-lightbox-color'],
  render(ctx, view, { source, rows }) {
    const items = []
    rows.forEach((row, i) => {
      const caption = slot(ctx, view.source, source, view, 'caption', row)
      const image = imageSlot(view, 'image', row, caption || source.labelSingular)
      if (!image) return
      const item = { id: rowId(row, i), ...image }
      if (caption) item.caption = caption
      if (isOn(rawValue(view, 'cover', row))) item.cover = true
      const href = linkSlot(view, 'link', row)
      if (href) item.href = href
      items.push(item)
    })
    const covers = items.filter((i) => i.cover)
    const rest = items.filter((i) => !i.cover)
    const sorted = [...covers, ...rest]
    return sorted.length ? [{ type: 'gallery', style: view.style || 'grid', items: sorted }] : []
  },
}

export default template
