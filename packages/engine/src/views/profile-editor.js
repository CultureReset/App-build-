// Admin template: profile-editor — one form over the business's single profile
// row, edited in place (business.profile is PATCHed without an id). Without
// write access — a read binding — it shows the values read-only. The
// `location` slot shows a read-only field above the form: the address as the
// server derives it (address_display), which is read, never written.

import { display, formFields, pick, rowId, slot } from '../view-helpers.js'
import { blankValues } from '../values.js'

const template = {
  name: 'profile-editor',
  surface: 'owner',
  summary: 'The business profile as one form, edited in place; read-only when the app may not write it.',
  spec: { slots: ['location'], single: true },
  tokens: ['--ng-profile-editor-gap', '--ng-profile-editor-columns', '--ng-profile-editor-label-color'],
  render(ctx, view, { sourceKey, source, rows }) {
    const can = ctx.can(source)
    const row = rows[0] || null
    if (!can.write) {
      const items = (source.fields || []).map((f) => ({ summary: f.label, body: display(ctx, sourceKey, f, row || {}) })).filter((it) => it.body)
      const blocks = [{ type: 'notice', tone: 'muted', text: ctx.copy.readOnly }]
      blocks.push(items.length ? { type: 'details', style: 'list', items } : { type: 'empty', text: view.emptyText || ctx.copy.empty })
      return blocks
    }
    const blocks = []
    const location = row ? slot(ctx, sourceKey, source, view, 'location', row) : ''
    if (location) blocks.push({ type: 'text', tone: 'muted', text: location })
    const id = row ? rowId(row, 0) : null
    const formId = `${sourceKey}:${id ?? 'new'}`
    blocks.push({
      type: 'form',
      id: formId,
      fields: formFields(source, { visitor: false }, ctx.lookupsBySource[sourceKey]),
      values: ctx.actions.values?.[formId] ?? (row ? pick(row, source.fields) : blankValues(source.fields)),
      errors: ctx.actions.errors?.[formId] || {},
      submit: { label: ctx.copy.save, action: row ? { type: 'record.update', source: sourceKey, id } : { type: 'record.create', source: sourceKey } },
    })
    return blocks
  },
}

export default template
