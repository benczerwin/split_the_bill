function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD" in local time, the format <input type="date"> expects/emits. */
export function nowAsDateOnly(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateOnly(value: string): string {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  // Built from parts (not `new Date(value)`) so it's interpreted in local time, not UTC —
  // otherwise the date can shift a day backward for timezones west of UTC.
  const d = new Date(year, month - 1, day)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}
