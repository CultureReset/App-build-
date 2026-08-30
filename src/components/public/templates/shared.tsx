import type { ModuleCollection } from '@/lib/modules/spec'
import { readValue } from '@/lib/runtime/values'
import type { RecordRow } from '@/lib/supabase/types'

/**
 * A row that declares an `available` or `visible` boolean is hidden from the
 * public surface when that flag is off. Owners get a soft delete for free.
 */
export function visibleRecords(collection: ModuleCollection, records: RecordRow[]): RecordRow[] {
  const flags = collection.fields.filter(
    (field) => field.type === 'boolean' && (field.key === 'visible' || field.key === 'available'),
  )

  if (flags.length === 0) {
    return records
  }

  return records.filter((row) => flags.every((field) => readValue(row.data, field.key) !== false))
}

export function text(row: RecordRow, key?: string): string {
  if (!key) {
    return ''
  }

  const value = readValue(row.data, key)
  return value === null || value === false ? '' : String(value)
}

export function number(row: RecordRow, key?: string): number | null {
  if (!key) {
    return null
  }

  const value = readValue(row.data, key)
  return typeof value === 'number' ? value : null
}

/**
 * Only http(s) links reach the page. Values are already validated on write;
 * this is the second, independent check at render time.
 */
export function safeHref(value: string): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function EmptyBlock({ label }: { label: string }) {
  return (
    <p
      className="pg-muted rounded-[var(--pg-radius)] border border-dashed px-4 py-8 text-center text-sm"
      style={{ borderColor: 'var(--pg-border)' }}
    >
      {label}
    </p>
  )
}

/** Images come from owner-supplied URLs, so they render unoptimised by design. */
export function BlockImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={className} />
}
