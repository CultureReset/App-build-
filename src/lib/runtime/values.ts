import type { ModuleCollection, ModuleField } from '@/lib/modules/spec'

export type FieldValue = string | number | boolean | null
export type RecordData = Record<string, FieldValue>

export type ValidationResult =
  | { ok: true; data: RecordData }
  | { ok: false; errors: Record<string, string> }

const MAX_TEXT = 400
const MAX_LONGTEXT = 4000

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+()\d\s.-]{5,24}$/
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

function textLimit(field: ModuleField): number {
  const ceiling = field.type === 'longtext' ? MAX_LONGTEXT : MAX_TEXT
  return Math.min(field.maxLength ?? ceiling, ceiling)
}

/** URLs are restricted to http(s) so a link block can never smuggle javascript:. */
function normaliseUrl(raw: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`

  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function coerce(field: ModuleField, raw: unknown): { value: FieldValue } | { error: string } {
  const isBlank =
    raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')

  if (isBlank) {
    if (field.required) {
      return { error: `${field.label} is required.` }
    }

    return { value: field.type === 'boolean' ? false : null }
  }

  switch (field.type) {
    case 'text':
    case 'longtext': {
      const value = String(raw).trim()

      if (value.length > textLimit(field)) {
        return { error: `${field.label} must be ${textLimit(field)} characters or fewer.` }
      }

      return { value }
    }

    case 'number':
    case 'money': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''))

      if (!Number.isFinite(value)) {
        return { error: `${field.label} must be a number.` }
      }

      if (field.min !== undefined && value < field.min) {
        return { error: `${field.label} must be at least ${field.min}.` }
      }

      if (field.max !== undefined && value > field.max) {
        return { error: `${field.label} must be at most ${field.max}.` }
      }

      return { value: field.type === 'money' ? Math.round(value * 100) / 100 : value }
    }

    case 'boolean':
      return { value: raw === true || raw === 'true' || raw === 'on' || raw === '1' }

    case 'select': {
      const value = String(raw)
      const allowed = field.options?.some((option) => option.value === value)

      if (!allowed) {
        return { error: `${field.label} is not a valid choice.` }
      }

      return { value }
    }

    case 'date': {
      const value = String(raw).trim()

      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        return { error: `${field.label} must be a valid date.` }
      }

      return { value }
    }

    case 'time': {
      const value = String(raw).trim()

      if (!/^\d{2}:\d{2}$/.test(value)) {
        return { error: `${field.label} must be a valid time.` }
      }

      return { value }
    }

    case 'email': {
      const value = String(raw).trim().toLowerCase()

      if (!EMAIL_PATTERN.test(value) || value.length > 200) {
        return { error: `${field.label} must be a valid email address.` }
      }

      return { value }
    }

    case 'phone': {
      const value = String(raw).trim()

      if (!PHONE_PATTERN.test(value)) {
        return { error: `${field.label} must be a valid phone number.` }
      }

      return { value }
    }

    case 'url':
    case 'image': {
      const value = normaliseUrl(String(raw).trim())

      if (!value || value.length > 2000) {
        return { error: `${field.label} must be a valid http or https link.` }
      }

      return { value }
    }

    case 'color': {
      const value = String(raw).trim()

      if (!COLOR_PATTERN.test(value)) {
        return { error: `${field.label} must be a colour like #4d4de5.` }
      }

      return { value }
    }
  }
}

/**
 * Validates a submitted payload against a set of declared fields.
 *
 * Unknown keys are dropped rather than rejected, so a stale form or a modified
 * client can never write a field the module did not declare.
 */
export function validateFields(fields: ModuleField[], input: Record<string, unknown>): ValidationResult {
  const data: RecordData = {}
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const result = coerce(field, input[field.key])

    if ('error' in result) {
      errors[field.key] = result.error
      continue
    }

    data[field.key] = result.value
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, data }
}

/** Owner-side write: every declared field is in play. */
export function validateOwnerRecord(
  collection: ModuleCollection,
  input: Record<string, unknown>,
): ValidationResult {
  return validateFields(collection.fields, input)
}

/**
 * Visitor-side write: fields marked `ownerOnly` are stripped from the form and
 * are re-applied here from their declared defaults, so a visitor cannot set
 * their own status, flag or price no matter what they post.
 */
export function validatePublicRecord(
  collection: ModuleCollection,
  input: Record<string, unknown>,
): ValidationResult {
  const visitorFields = collection.fields.filter((field) => !field.ownerOnly)
  const result = validateFields(visitorFields, input)

  if (!result.ok) {
    return result
  }

  for (const field of collection.fields) {
    if (!field.ownerOnly) {
      continue
    }

    result.data[field.key] =
      field.defaultValue !== undefined ? (field.defaultValue as FieldValue) : null
  }

  return result
}

/** Starting values for a blank owner form. */
export function emptyRecord(collection: ModuleCollection): RecordData {
  const data: RecordData = {}

  for (const field of collection.fields) {
    data[field.key] =
      field.defaultValue !== undefined
        ? (field.defaultValue as FieldValue)
        : field.type === 'boolean'
          ? false
          : null
  }

  return data
}

export function readValue(data: Record<string, unknown>, key: string): FieldValue {
  const value = data[key]

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return null
}
