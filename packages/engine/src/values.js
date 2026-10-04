// Field values: checked and coerced the same way on every screen.
//
// Unknown keys are dropped, never stored, so a stale form or a modified client
// can never write a field the manifest did not declare. A visitor's write also
// loses every owner-only field, which is set back to its declared default.
// gcr-api-clean repeats its own checks on the way in; this is the first gate,
// not the only one.

const MAX_TEXT = 400
const MAX_LONGTEXT = 4000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[+()\d\s.-]{5,24}$/
const COLOR = /^#[0-9a-fA-F]{6}$/

/** Link schemes a block may carry. Images are stricter: http(s) only. */
export const LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:', 'sms:']

function textLimit(field) {
  const ceiling = field.type === 'longtext' ? MAX_LONGTEXT : MAX_TEXT
  return Math.min(field.maxLength ?? ceiling, ceiling)
}

/** An http(s) URL, or null. A bare host gets https:// in front. */
export function normaliseUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const value = raw.trim()
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const u = new URL(candidate)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** A link a visitor may follow: http(s), mailto, tel or sms. Anything else is dropped. */
export function safeHref(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const u = new URL(raw.trim())
    return LINK_SCHEMES.includes(u.protocol) ? u.toString() : null
  } catch {
    return null
  }
}

/** An image source: http(s) only. */
export function safeImage(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function optionValues(field, lookups) {
  if (Array.isArray(field.options) && field.options.length) return field.options.map((o) => o.value)
  const list = lookups && field.optionsFrom ? lookups[field.key] : null
  return list ? list.map((o) => o.value) : null
}

function coerce(field, raw, lookups) {
  const blank = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')
  if (blank) {
    if (field.required && field.type !== 'boolean') return { error: `${field.label} is required.` }
    return { value: field.type === 'boolean' ? false : null }
  }
  switch (field.type) {
    case 'text':
    case 'longtext': {
      const value = String(raw).trim()
      if (value.length > textLimit(field)) return { error: `${field.label} must be ${textLimit(field)} characters or fewer.` }
      return { value }
    }
    case 'number':
    case 'money': {
      // Typed numbers may carry spaces, thousands separators and a leading
      // currency sign; anything else that is not a number is refused, never 0.
      const text = typeof raw === 'number' ? raw : String(raw).replace(/[\s,]/g, '').replace(/^[^\d.-]+/, '')
      const value = typeof text === 'number' ? text : /^-?(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : NaN
      if (!Number.isFinite(value)) return { error: `${field.label} must be a number.` }
      if (field.min !== undefined && value < field.min) return { error: `${field.label} must be at least ${field.min}.` }
      if (field.max !== undefined && value > field.max) return { error: `${field.label} must be at most ${field.max}.` }
      return { value: field.type === 'money' ? Math.round(value * 100) / 100 : value }
    }
    case 'boolean':
      return { value: raw === true || raw === 'true' || raw === 'on' || raw === '1' || raw === 1 }
    case 'select': {
      const allowed = optionValues(field, lookups)
      const value = typeof raw === 'number' ? raw : String(raw)
      // Options from another source are checked when that source was loaded;
      // gcr-api-clean checks the reference itself either way.
      if (allowed && !allowed.map(String).includes(String(value))) return { error: `${field.label} is not a valid choice.` }
      return { value }
    }
    case 'date': {
      const value = String(raw).trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return { error: `${field.label} must be a valid date.` }
      return { value }
    }
    case 'time': {
      const value = String(raw).trim()
      if (!/^\d{2}:\d{2}$/.test(value)) return { error: `${field.label} must be a valid time.` }
      return { value }
    }
    case 'email': {
      const value = String(raw).trim().toLowerCase()
      if (!EMAIL.test(value) || value.length > 200) return { error: `${field.label} must be a valid email address.` }
      return { value }
    }
    case 'phone': {
      const value = String(raw).trim()
      if (!PHONE.test(value)) return { error: `${field.label} must be a valid phone number.` }
      return { value }
    }
    case 'url':
    case 'image': {
      const value = normaliseUrl(String(raw))
      if (!value || value.length > 2000) return { error: `${field.label} must be a valid http or https link.` }
      return { value }
    }
    case 'color': {
      const value = String(raw).trim()
      if (!COLOR.test(value)) return { error: `${field.label} must be a colour like #4d4de5.` }
      return { value }
    }
    default:
      return { error: `${field.label} has a type the engine does not know.` }
  }
}

/**
 * Check input against declared fields.
 * @param {object[]} fields
 * @param {Record<string, unknown>} input
 * @param {{ visitor?: boolean, lookups?: Record<string, {value, label}[]> }} [options]
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, errors: Record<string, string> }}
 */
export function checkValues(fields, input, { visitor = false, lookups } = {}) {
  const data = {}
  const errors = {}
  const source = input && typeof input === 'object' ? input : {}
  for (const field of fields) {
    if (field.readOnly) continue
    if (visitor && field.ownerOnly) {
      // Re-applied from the declaration: a visitor cannot set it.
      data[field.key] = field.default !== undefined ? field.default : null
      continue
    }
    const result = coerce(field, source[field.key], lookups)
    if ('error' in result) errors[field.key] = result.error
    else data[field.key] = result.value
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data }
}

/** Starting values for a blank form. */
export function blankValues(fields) {
  const out = {}
  for (const f of fields) out[f.key] = f.default !== undefined ? f.default : f.type === 'boolean' ? false : null
  return out
}

/** Settings with their declared defaults filled in, unknown keys dropped. */
export function settingsWithDefaults(manifest, settings) {
  const out = {}
  const given = settings && typeof settings === 'object' ? settings : {}
  for (const f of Array.isArray(manifest?.config) ? manifest.config : []) {
    if (given[f.key] !== undefined && given[f.key] !== null) out[f.key] = given[f.key]
    else if (f.default !== undefined) out[f.key] = f.default
  }
  return out
}

/** The v1 settings declaration as engine fields, so one form drawer serves both. */
export function settingsFields(manifest) {
  return (Array.isArray(manifest?.config) ? manifest.config : []).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type === 'select' ? 'select' : f.type === 'url' ? 'url' : f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : 'text',
    secret: f.type === 'secret' || undefined,
    required: f.required || false,
    help: f.help,
    options: f.type === 'select' ? (f.options || []).map((o) => ({ value: o, label: o })) : undefined,
    default: f.default,
  }))
}
