import type { ModuleField } from '@/lib/modules/spec'

/**
 * Derives a snake_case field key from a human label, disambiguating against
 * keys already in use.
 *
 * Shared between the manual field editor and the AI draft mapper so a field
 * added by typing "Party size" and one proposed by the model as "Party size"
 * become the identical key — one source of truth for how labels turn into
 * storage keys.
 */
export function keyFrom(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^([0-9])/, 'f$1')
      .slice(0, 40) || 'field'

  let key = base
  let counter = 2

  while (taken.includes(key)) {
    key = `${base}_${counter}`
    counter += 1
  }

  return key
}

export function blankField(label: string, taken: string[]): ModuleField {
  return {
    key: keyFrom(label, taken),
    label,
    type: 'text',
    required: false,
    ownerOnly: false,
    maxLength: 120,
  }
}
