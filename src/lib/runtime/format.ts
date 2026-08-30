import type { ModuleField } from '@/lib/modules/spec'
import type { FieldValue } from '@/lib/runtime/values'

/**
 * Groups thousands and shows cents only when there are any, so a menu item
 * reads "$12.50" and a house reads "$540,000" rather than "$540000.00".
 */
export function formatMoney(value: number, currency = '$'): string {
  const hasCents = Math.round(value * 100) % 100 !== 0

  return `${currency}${value.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

export function formatValue(field: ModuleField, value: FieldValue, currency = '$'): string {
  if (value === null || value === '') {
    return ''
  }

  switch (field.type) {
    case 'money':
      return formatMoney(Number(value), currency)
    case 'boolean':
      return value ? 'Yes' : 'No'
    case 'select':
      return field.options?.find((option) => option.value === value)?.label ?? String(value)
    case 'date':
      return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    default:
      return String(value)
  }
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const seconds = Math.round((Date.now() - then) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`

  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
