function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD" in local time, the format <input type="date"> expects/emits. */
export function nowAsDateOnly(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Coerces any previously-stored date value to plain "YYYY-MM-DD". Older saved bills (and
 * PDFs exported before the date field dropped its time component) hold a datetime-local
 * value like "2026-08-14T19:30" — a value <input type="date"> rejects as invalid, so it
 * would otherwise render blank. Falls back to today when there's nothing usable.
 */
export function toDateOnly(value: string | undefined | null): string {
  const datePart = value?.split('T')[0]
  return datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : nowAsDateOnly()
}

export function formatDateOnly(value: string): string {
  if (!value) return ''
  const [year, month, day] = value.split('T')[0].split('-').map(Number)
  if (!year || !month || !day) return value
  // Built from parts (not `new Date(value)`) so it's interpreted in local time, not UTC —
  // otherwise the date can shift a day backward for timezones west of UTC.
  const d = new Date(year, month - 1, day)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}
