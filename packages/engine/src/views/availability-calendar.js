// Admin template: availability-calendar — the claims on a month or week, with
// "add" on every day (the form opens with that date filled in) and edit /
// remove on every claim. Blocking a date is adding a claim for it.

import { calendarDays, editorBlocks, editDeleteButtons } from '../view-helpers.js'
import { claimEntry, CLAIM_SLOTS, CLAIM_SLOT_TYPES } from './availability.js'
import { fill } from '../copy.js'

const template = {
  name: 'availability-calendar',
  surface: 'owner',
  summary: 'Claims on a month or week: add on a day, edit or remove a claim.',
  spec: {
    slots: CLAIM_SLOTS.filter((s) => s !== 'link'),
    required: ['date'],
    slotTypes: CLAIM_SLOT_TYPES,
    styles: ['month', 'week', 'list'],
  },
  tokens: ['--ng-availability-calendar-gap', '--ng-availability-calendar-day-min', '--ng-availability-calendar-add-size', '--ng-availability-calendar-entry-bg'],
  render(ctx, view, { sourceKey, source, rows }) {
    const can = ctx.can(source)
    const blocks = []
    if (!can.write && source.from === 'business') blocks.push({ type: 'notice', tone: 'muted', text: ctx.copy.readOnly })
    blocks.push(...editorBlocks(ctx, sourceKey, source, rows, { can }))
    const entries = rows.map((row, i) => {
      const e = claimEntry(ctx, view, sourceKey, source, row, i)
      if (can.write) e.actions = editDeleteButtons(ctx, sourceKey, e.id)
      return e
    })
    const cal = calendarDays(entries, { style: view.style || 'month', now: ctx.now, locale: ctx.format.locale })
    if (can.write) {
      const dateKey = view.fields.date
      for (const day of cal.days) day.actions = [{ label: fill(ctx.copy.add, { item: source.labelSingular.toLowerCase() }), icon: '+', style: 'ghost', action: { type: 'view.new', source: sourceKey, values: { [dateKey]: day.date } } }]
    }
    blocks.push(cal.days.length ? cal : { type: 'empty', text: view.emptyText || ctx.copy.empty })
    return blocks
  },
}

export default template
