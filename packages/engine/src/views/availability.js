// Template: availability — dates and times with capacity and status, from the
// business's claims (availability.claims), as a list of dates, a month or a
// week. An optional link per row (where to book).

import { calendarDays, display, fieldOf, linkSlot, rawSlot, rowId, slot, slug } from '../view-helpers.js'

export const CLAIM_SLOTS = ['date', 'end', 'time', 'status', 'capacity', 'title', 'link']
export const CLAIM_SLOT_TYPES = { date: 'date', end: 'date', time: 'time' }

/** A row as a calendar entry: what the two availability templates share. */
export function claimEntry(ctx, view, sourceKey, source, row, i) {
  const entry = { id: rowId(row, i), date: rawSlot(view, 'date', row).slice(0, 10) }
  const end = rawSlot(view, 'end', row).slice(0, 10)
  if (end) entry.end = end
  const time = rawSlot(view, 'time', row)
  if (time) entry.time = time
  const title = view.fields?.title ? display(ctx, sourceKey, fieldOf(source, view.fields.title), row) : ''
  if (title) entry.title = title
  const status = slot(ctx, sourceKey, source, view, 'status', row)
  if (status) {
    entry.status = status
    entry.key = slug(status)
  }
  const capacity = Number(rawSlot(view, 'capacity', row))
  if (Number.isFinite(capacity) && rawSlot(view, 'capacity', row) !== '') entry.capacity = capacity
  const href = linkSlot(view, 'link', row)
  if (href) entry.href = href
  return entry
}

const template = {
  name: 'availability',
  surface: 'public',
  summary: 'Dates and times with capacity and status, as a list, a month or a week; an optional link per date.',
  spec: {
    slots: CLAIM_SLOTS,
    required: ['date'],
    slotTypes: CLAIM_SLOT_TYPES,
    styles: ['list', 'month', 'week'],
  },
  tokens: [
    '--ng-availability-gap', '--ng-availability-day-min', '--ng-availability-day-radius', '--ng-availability-day-bg', '--ng-availability-day-border',
    '--ng-availability-today-border', '--ng-availability-busy-bg', '--ng-availability-entry-bg', '--ng-availability-entry-color', '--ng-availability-entry-radius',
    '--ng-availability-label-size', '--ng-availability-weekday-color',
  ],
  render(ctx, view, { sourceKey, source, rows }) {
    const entries = rows.map((row, i) => claimEntry(ctx, view, sourceKey, source, row, i))
    const cal = calendarDays(entries, { style: view.style || 'list', now: ctx.now, locale: ctx.format.locale })
    if (!cal.days.length) return []
    return [cal]
  },
}

export default template
