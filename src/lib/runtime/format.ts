import type { ModuleField } from '@/lib/modules/spec'
import type { FieldValue } from '@/lib/runtime/values'

export function formatValue(field: ModuleField, value: FieldValue, currency = '$'): string {
  if (value === null || value === '') {
    return ''
  }

  switch (field.type) {
    case 'money':
      return `${currency}${Number(value).toFixed(2)}`
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
