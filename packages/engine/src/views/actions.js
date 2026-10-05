// Template: actions — the Call / Text / Email / Website / Book / Directions row.
// Reads the first row of its source (business.profile has one) and turns the
// contact slots it bound into buttons: a phone becomes tel:, an email mailto:.
// Button variant or icon variant; icons come from the owner's stylesheet
// (.ng-key-call …), never from here.

import { contactButtons, CONTACT_SLOTS } from '../view-helpers.js'

const STYLE_TO_BUTTONS = { buttons: 'inline', icons: 'icons', grid: 'grid', stack: 'stack' }

const template = {
  name: 'actions',
  surface: 'public',
  summary: 'One button per way to reach the business: call, text, email, website, book, directions.',
  spec: {
    slots: CONTACT_SLOTS.map((c) => c.slot),
    styles: Object.keys(STYLE_TO_BUTTONS),
    single: true,
  },
  tokens: ['--ng-actions-gap', '--ng-actions-justify', '--ng-actions-icon-size', '--ng-actions-button-radius', '--ng-actions-button-padding'],
  check(view, { add }) {
    const bound = Object.keys(view.fields || {})
    if (!bound.length) add('', `binds at least one of ${CONTACT_SLOTS.map((c) => c.slot).join(', ')}.`)
  },
  render(ctx, view, { rows }) {
    const row = rows[0]
    if (!row) return []
    const items = contactButtons(ctx, view, row)
    if (!items.length) return []
    return [{ type: 'buttons', style: STYLE_TO_BUTTONS[view.style] || 'inline', items }]
  },
}

export default template
