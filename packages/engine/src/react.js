'use client'

// React drawing of blocks, for Play-user (owner screen) and gcr-unified
// (public page block). Written with createElement so it needs no JSX build
// step and works the same in Vite, Next and plain Node tests.
//
//   <Blocks blocks onAction />          draws a block tree; buttons and forms
//                                        call onAction(action, values, block)
//   <EngineApp manifest adapter … />    loads data through an adapter, renders
//                                        with renderOwner / renderPublic, and
//                                        carries out actions through the adapter
//
// Class names are `${prefix}-<type>` (prefix defaults to "ng"); each screen
// styles them in its own way. src/styles.css is an optional starting point.

import { createElement as h, Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { renderOwner, renderPublic, renderSurface, checkRecord } from './render.js'

const INPUT = { email: 'email', phone: 'tel', number: 'number', money: 'number', date: 'date', time: 'time', url: 'url', image: 'url', color: 'color', secret: 'password' }

function okHref(href, schemes) {
  try {
    return schemes.includes(new URL(String(href)).protocol)
  } catch {
    return false
  }
}
const LINK = ['http:', 'https:', 'mailto:', 'tel:', 'sms:']
const IMG = ['http:', 'https:']

function Anchor({ href, className, children }) {
  if (!okHref(href, LINK)) return h('span', { className }, children)
  return h('a', { href, className, target: '_blank', rel: 'noopener noreferrer nofollow ugc' }, children)
}

function Button({ b, p, onAction, busy }) {
  const className = `${p}-button ${p}-button--${b.style || 'primary'}`
  const inner = [
    b.icon ? h('span', { key: 'i', className: `${p}-icon`, 'aria-hidden': true }, b.icon) : null,
    h('span', { key: 'l', className: `${p}-label` }, b.label),
    b.note ? h('span', { key: 'n', className: `${p}-note` }, b.note) : null,
  ]
  if (b.href) return h(Anchor, { href: b.href, className }, inner)
  return h(
    'button',
    { type: 'button', className, disabled: Boolean(b.disabled || busy), 'aria-label': b.icon && b.label ? b.label : undefined, onClick: () => onAction?.(b.action, undefined, b) },
    inner,
  )
}

function Field({ f, value, error, onChange, p, formId, disabled }) {
  const id = `${p}-${formId}-${f.key}`.replace(/[^A-Za-z0-9_-]/g, '-')
  const shown = value === undefined || value === null ? '' : String(value)
  const common = { id, name: f.key, required: Boolean(f.required), disabled }
  let control
  if (f.type === 'longtext') {
    control = h('textarea', { ...common, value: shown, maxLength: f.maxLength, placeholder: f.placeholder, onChange: (e) => onChange(e.target.value) })
  } else if (f.type === 'select') {
    control = h(
      'select',
      { ...common, value: shown, onChange: (e) => onChange(e.target.value) },
      h('option', { value: '' }, ''),
      (f.options || []).map((o) => h('option', { key: String(o.value), value: String(o.value) }, o.label)),
    )
  } else if (f.type === 'boolean') {
    control = h('input', { ...common, type: 'checkbox', checked: value === true || value === 'true', onChange: (e) => onChange(e.target.checked) })
  } else {
    const numeric = f.type === 'number' || f.type === 'money'
    control = h('input', {
      ...common,
      type: INPUT[f.type] || 'text',
      value: shown,
      step: f.type === 'money' ? '0.01' : undefined,
      min: f.min,
      max: f.max,
      maxLength: f.maxLength,
      placeholder: f.placeholder,
      autoComplete: f.type === 'secret' ? 'new-password' : undefined,
      onChange: (e) => onChange(numeric && e.target.value !== '' ? Number(e.target.value) : e.target.value),
    })
  }
  return h(
    'label',
    { className: `${p}-field ${p}-field--${f.type}`, htmlFor: id },
    h('span', { className: `${p}-field-label` }, f.label),
    control,
    f.help ? h('span', { className: `${p}-help` }, f.help) : null,
    error ? h('span', { className: `${p}-error`, role: 'alert' }, error) : null,
  )
}

function Form({ b, p, onAction, busy }) {
  // Keyed by its id and starting values (see Block), so another row opened
  // or a reset after sending mounts a fresh form.
  const [values, setValues] = useState(() => ({ ...(b.values || {}) }))
  const errors = b.errors || {}
  return h(
    'form',
    {
      className: `${p}-form${b.style ? ` ${p}-form--${b.style}` : ''}`,
      noValidate: true,
      onSubmit: (e) => {
        e.preventDefault()
        if (!b.readOnly) onAction?.(b.submit.action, values, b)
      },
    },
    b.intro ? h('p', { className: `${p}-form-intro` }, b.intro) : null,
    errors._form ? h('p', { className: `${p}-error`, role: 'alert' }, errors._form) : null,
    (b.fields || []).map((f) =>
      h(Field, { key: f.key, f, p, formId: b.id, value: values[f.key], error: errors[f.key], disabled: busy || b.readOnly, onChange: (v) => setValues((cur) => ({ ...cur, [f.key]: v })) }),
    ),
    h(
      'div',
      { className: `${p}-form-actions` },
      b.readOnly ? null : h('button', { type: 'submit', className: `${p}-button ${p}-button--primary`, disabled: busy }, b.submit.label),
      b.cancel ? h(Button, { b: b.cancel, p, onAction, busy }) : null,
    ),
  )
}

function ListItem({ it, p }) {
  const inner = [
    it.image && okHref(it.image.src, IMG) ? h('img', { key: 'img', className: `${p}-item-image`, src: it.image.src, alt: it.image.alt || '', loading: 'lazy' }) : null,
    h('span', { key: 't', className: `${p}-item-title` }, it.title),
    it.badge ? h('span', { key: 'b', className: `${p}-item-badge` }, it.badge) : null,
    it.value ? h('span', { key: 'v', className: `${p}-item-value` }, it.value) : null,
    it.subtitle ? h('span', { key: 's', className: `${p}-item-subtitle` }, it.subtitle) : null,
    it.meta?.length ? h('span', { key: 'm', className: `${p}-item-meta` }, it.meta.join(' · ')) : null,
    it.body ? h('span', { key: 'bd', className: `${p}-item-body` }, it.body) : null,
    it.time ? h('span', { key: 'tm', className: `${p}-item-time` }, it.time) : null,
  ]
  return h('li', { className: `${p}-item` }, it.href ? h(Anchor, { href: it.href, className: `${p}-item-link` }, inner) : inner)
}

function Block({ b, p, onAction, busy, depth }) {
  switch (b.type) {
    case 'section': {
      const level = Math.min(6, 2 + depth)
      return h(
        'section',
        { className: `${p}-section` },
        b.title ? h(`h${level}`, { className: `${p}-section-title` }, b.title) : null,
        h(BlockList, { blocks: b.blocks, p, onAction, busy, depth: depth + 1 }),
      )
    }
    case 'heading':
      return h(`h${Math.min(6, 1 + b.level)}`, { className: `${p}-heading` }, b.text)
    case 'text':
      return h('p', { className: `${p}-text${b.tone ? ` ${p}-text--${b.tone}` : ''}` }, b.text)
    case 'notice':
      return h('p', { className: `${p}-notice${b.tone ? ` ${p}-notice--${b.tone}` : ''}`, role: 'status' }, b.text)
    case 'empty':
      return h('p', { className: `${p}-empty` }, b.text)
    case 'divider':
      return h('hr', { className: `${p}-divider` })
    case 'list':
      return h('ul', { className: `${p}-list ${p}-list--${b.style}` }, (b.items || []).map((it, i) => h(ListItem, { key: it.id || i, it, p })))
    case 'table':
      return h(
        'table',
        { className: `${p}-table` },
        h('thead', null, h('tr', null, (b.columns || []).map((c) => h('th', { key: c.key, scope: 'col' }, c.label)), b.rows?.some((r) => r.actions?.length) ? h('th', { key: '_a' }) : null)),
        h(
          'tbody',
          null,
          !(b.rows || []).length && b.empty ? h('tr', null, h('td', { colSpan: (b.columns || []).length + 1 }, b.empty)) : null,
          (b.rows || []).map((r) =>
            h(
              'tr',
              { key: r.id },
              (b.columns || []).map((c) => h('td', { key: c.key }, r.cells?.[c.key] ?? '')),
              r.actions?.length ? h('td', { key: '_a', className: `${p}-row-actions` }, r.actions.map((a, i) => h(Button, { key: i, b: a, p, onAction, busy }))) : null,
            ),
          ),
        ),
      )
    case 'image': {
      if (!okHref(b.src, IMG)) return null
      const img = h('img', { src: b.src, alt: b.alt, loading: 'lazy' })
      return h('figure', { className: `${p}-image` }, b.href ? h(Anchor, { href: b.href, className: `${p}-image-link` }, img) : img, b.caption ? h('figcaption', null, b.caption) : null)
    }
    case 'images':
      return h(
        'ul',
        { className: `${p}-images ${p}-images--${b.style}` },
        (b.items || []).filter((it) => okHref(it.src, IMG)).map((it, i) => {
          const img = h('img', { src: it.src, alt: it.alt, loading: 'lazy' })
          return h('li', { key: i }, h('figure', null, it.href ? h(Anchor, { href: it.href, className: `${p}-image-link` }, img) : img, it.caption ? h('figcaption', null, it.caption) : null))
        }),
      )
    case 'button':
      return h(Button, { b, p, onAction, busy })
    case 'buttons':
      return h('div', { className: `${p}-buttons ${p}-buttons--${b.style}` }, (b.items || []).map((it, i) => h(Button, { key: i, b: it, p, onAction, busy })))
    case 'details':
      return b.style === 'list'
        ? h('dl', { className: `${p}-details ${p}-details--list` }, (b.items || []).map((it, i) => h(Fragment, { key: i }, h('dt', null, it.summary), h('dd', null, it.body))))
        : h('div', { className: `${p}-details ${p}-details--accordion` }, (b.items || []).map((it, i) => h('details', { key: i }, h('summary', null, it.summary), h('p', null, it.body))))
    case 'embed':
      if (!okHref(b.src, ['https:'])) return null
      return h(
        'div',
        { className: `${p}-embed` },
        h('iframe', { src: b.src, title: b.title, loading: 'lazy', referrerPolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-presentation', allow: 'encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true }),
      )
    case 'form':
      return h(Form, { key: `${b.id}|${JSON.stringify(b.values || {})}`, b, p, onAction, busy })
    default:
      return null
  }
}

function BlockList({ blocks, p, onAction, busy, depth }) {
  return h(Fragment, null, (blocks || []).map((b, i) => h(Block, { key: `${b.type}-${i}`, b, p, onAction, busy, depth })))
}

/** Draw a block tree. */
export function Blocks({ blocks, onAction, busy = false, prefix = 'ng', className }) {
  return h('div', { className: className || `${prefix}-blocks` }, h(BlockList, { blocks, p: prefix, onAction, busy, depth: 0 }))
}

/**
 * A whole installed app on one screen.
 *
 * @param {{
 *   manifest: object,
 *   surface?: 'owner' | 'public' | string,  // a surface id draws just that surface
 *   adapter: object,                         // createGcrAdapter / createPublicAdapter
 *   options?: object,                        // copy, locale, currency, embeds
 *   prefix?: string,
 *   onError?: (err: Error) => void,
 * }} props
 */
export function EngineApp({ manifest, surface = 'owner', adapter, options, prefix = 'ng', onError }) {
  const [state, setState] = useState({ loading: true, settings: {}, granted: undefined, data: {}, business: {}, loadError: null })
  const [ui, setUi] = useState({ editing: null, values: {}, errors: {}, submitted: {} })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const loaded = await adapter.load(manifest, surface)
      setState({ loading: false, settings: loaded.settings || {}, granted: loaded.granted, data: loaded.data || {}, business: loaded.business || {}, loadError: null })
    } catch (err) {
      setState((s) => ({ ...s, loading: false, loadError: err }))
      onError?.(err)
    }
  }, [adapter, manifest, surface, onError])

  useEffect(() => {
    load()
  }, [load])

  const blocks = useMemo(() => {
    const actions = { granted: state.granted, ...ui }
    // Values read from the business through format bindings (business.currency …) reach the renderer here.
    const opts = { ...options, business: { ...(options?.business || {}), ...state.business } }
    if (surface === 'owner') return renderOwner(manifest, state.settings, state.data, actions, opts)
    if (surface === 'public') return renderPublic(manifest, state.settings, state.data, actions, opts)
    return renderSurface(manifest, surface, state.settings, state.data, actions, opts)
  }, [manifest, surface, state, ui, options])

  const onAction = useCallback(
    async (action, values, block) => {
      if (!action) return
      const formId = block?.id
      const fail = (err) => {
        const errors = err?.errors || { _form: err?.message || String(err) }
        setUi((u) => ({ ...u, values: formId ? { ...u.values, [formId]: values } : u.values, errors: formId ? { ...u.errors, [formId]: errors } : u.errors }))
        if (!err?.errors) onError?.(err)
      }
      const clear = (extra = {}) =>
        setUi((u) => {
          const next = { ...u, ...extra, values: { ...u.values }, errors: { ...u.errors } }
          if (formId) {
            delete next.values[formId]
            delete next.errors[formId]
          }
          return next
        })
      switch (action.type) {
        case 'view.new':
          return setUi((u) => ({ ...u, editing: { source: action.source, id: null } }))
        case 'view.edit':
          return setUi((u) => ({ ...u, editing: { source: action.source, id: action.id } }))
        case 'view.cancel':
          return clear({ editing: null })
      }
      setBusy(true)
      try {
        if (action.type === 'record.create' || action.type === 'record.update') {
          const checked = checkRecord(manifest, action.source, values, { data: state.data })
          if (!checked.ok) return fail({ errors: checked.errors })
          if (action.type === 'record.create') await adapter.create(manifest, action.source, values, { rows: state.data[action.source] || [], data: state.data })
          else await adapter.update(manifest, action.source, action.id, values, { data: state.data })
          clear({ editing: null })
          await load()
        } else if (action.type === 'record.delete') {
          await adapter.remove(manifest, action.source, action.id)
          await load()
        } else if (action.type === 'record.move') {
          await adapter.move(manifest, action.source, state.data[action.source] || [], action.id, action.direction)
          await load()
        } else if (action.type === 'settings.save') {
          const settings = await adapter.saveSettings(manifest, values)
          clear()
          setState((s) => ({ ...s, settings: { ...s.settings, ...settings } }))
        } else if (action.type === 'form.submit') {
          const checked = checkRecord(manifest, action.source, values, { visitor: true, data: state.data })
          if (!checked.ok) return fail({ errors: checked.errors })
          await adapter.submit(manifest, action.source, values, { data: state.data })
          setUi((u) => {
            const next = { ...u, submitted: { ...u.submitted, [formId]: true }, values: { ...u.values }, errors: { ...u.errors } }
            delete next.values[formId]
            delete next.errors[formId]
            return next
          })
        }
      } catch (err) {
        fail(err)
      } finally {
        setBusy(false)
      }
    },
    [adapter, manifest, state.data, load, onError],
  )

  if (state.loading) return h('div', { className: `${prefix}-blocks ${prefix}-loading`, 'aria-busy': true })
  if (state.loadError) return h(Blocks, { prefix, blocks: [{ type: 'notice', tone: 'danger', text: state.loadError.message || String(state.loadError) }] })
  return h(Blocks, { blocks, onAction, busy, prefix })
}
