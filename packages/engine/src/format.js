// Turning stored values into display text. Locale and currency come from the
// install's settings (manifest ui.format) or the screen that draws the app;
// nothing here assumes a country, a language or a currency.

/** ui.format.currency / .locale resolve to a literal or to a setting's value. */
export function resolveFormat(manifest, settings, options = {}) {
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const pick = (ref) => {
    if (typeof ref === 'string') return ref
    if (ref && typeof ref === 'object' && typeof ref.setting === 'string') return text(settings?.[ref.setting])
    // { binding } reads the business: the adapter's load() puts each format
    // binding's value under options.business[<binding key>].
    if (ref && typeof ref === 'object' && typeof ref.binding === 'string') return text(options.business?.[ref.binding])
    return undefined
  }
  const fmt = manifest?.ui?.format || {}
  return {
    currency: pick(fmt.currency) ?? options.currency,
    locale: pick(fmt.locale) ?? options.locale,
  }
}

/**
 * Money. A three-letter code goes through Intl (correct symbol and decimals for
 * the locale); anything else is used as a prefix symbol, which is what an owner
 * typing "$" or "€" into a setting expects. No currency: just the number.
 */
export function formatMoney(value, { currency, locale } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  const hasCents = Math.round(n * 100) % 100 !== 0
  const digits = { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 }
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, ...digits }).format(n)
    } catch {
      // An unknown code falls through to the plain form.
    }
  }
  let body
  try {
    body = new Intl.NumberFormat(locale, digits).format(n)
  } catch {
    body = String(n)
  }
  return `${currency || ''}${body}`
}

export function formatDate(value, { locale } = {}) {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return String(value)
  try {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** "just now", "5m ago" … then a date. The words come from the copy table. */
export function relativeTime(iso, { now = Date.now(), locale, copy } = {}) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.round((now - then) / 1000)
  if (seconds < 60) return copy.justNow
  if (seconds < 3600) return copy.minutesAgo.replace('{n}', Math.floor(seconds / 60))
  if (seconds < 86400) return copy.hoursAgo.replace('{n}', Math.floor(seconds / 3600))
  try {
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  } catch {
    return new Date(iso).toISOString().slice(0, 10)
  }
}

/** Display text for one field's value. */
export function formatValue(field, value, ctx = {}) {
  if (value === null || value === undefined || value === '') return ''
  switch (field?.type) {
    case 'money':
      return formatMoney(value, ctx)
    case 'boolean':
      return value ? ctx.copy?.yes ?? 'Yes' : ctx.copy?.no ?? 'No'
    case 'select': {
      const options = optionList(field, ctx.lookups)
      return options.find((o) => String(o.value) === String(value))?.label ?? String(value)
    }
    case 'date':
      return formatDate(value, ctx)
    default:
      return String(value)
  }
}

/** A select field's options: declared inline, or drawn from another source's rows. */
export function optionList(field, lookups) {
  if (Array.isArray(field?.options) && field.options.length) return field.options
  if (field?.optionsFrom && lookups && Array.isArray(lookups[field.key])) return lookups[field.key]
  return []
}
