// Template: social — the row of places a business is elsewhere. One button per
// row (business.links serves { network, url }); each carries a key slugged from
// its label so a stylesheet can give it an icon (.ng-key-<slug>). The engine
// knows no network.

import { display, fieldOf, linkSlot, slug } from '../view-helpers.js'

const template = {
  name: 'social',
  surface: 'public',
  summary: 'A compact row of links to the business elsewhere, each keyed by its label for icons.',
  spec: {
    slots: ['label', 'link'],
    required: ['link'],
    defaultSlot: 'label',
    styles: ['icons', 'inline', 'stack', 'grid'],
  },
  tokens: ['--ng-social-gap', '--ng-social-size', '--ng-social-radius', '--ng-social-bg', '--ng-social-color', '--ng-social-justify'],
  render(ctx, view, { sourceKey, source, rows }) {
    const labelField = fieldOf(source, view.fields?.label || source.title)
    const items = []
    for (const row of rows) {
      const href = linkSlot(view, 'link', row)
      if (!href) continue
      const label = display(ctx, sourceKey, labelField, row) || href
      items.push({ label, href, key: slug(label), style: 'secondary' })
    }
    return items.length ? [{ type: 'buttons', style: view.style || 'icons', items }] : []
  },
}

export default template
